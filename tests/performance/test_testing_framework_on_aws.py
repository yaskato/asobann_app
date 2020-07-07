from pathlib import Path
import re
import json
import os
import subprocess
import inspect
import pytest
import time
import urllib.request
from .cli import Aws, Ecs, AwsContainers
from pprint import pprint


def build_task_definition_controller(execution_role_arn, image_uri, region, workers):
    return {
        "containerDefinitions": [
            {
                "name": "test_run_multiprocess_in_container_controller",
                "image": image_uri,
                "cpu": 0,
                "portMappings": [
                    {
                        "containerPort": 8888,
                        "hostPort": 8888,
                        "protocol": "tcp"
                    },
                ],
                "essential": True,
                "command": [
                    "/usr/bin/python3",
                    "run.py",
                    "controller",
                    workers,
                ],
                "environment": [],
                "mountPoints": [],
                "volumesFrom": [],
                "logConfiguration": {
                    "logDriver": "awslogs",
                    "options": {
                        "awslogs-group": "/ecs/test_run_multiprocess_in_container_controller",
                        "awslogs-region": region,
                        "awslogs-stream-prefix": "ecs"
                    }
                }
            }
        ],
        "family": "test_run_multiprocess_in_container_controller",
        "executionRoleArn": execution_role_arn,
        "networkMode": "awsvpc",
        "volumes": [],
        "placementConstraints": [],
        "requiresCompatibilities": [
            "FARGATE"
        ],
        "cpu": "256",
        "memory": "512"
    }






class TestRunInMultiprocessOnAws:
    @staticmethod
    @pytest.fixture
    def worker_ecr():
        ecr = Aws.get_ecr('test_run_multiprocess_in_container_worker')
        yield ecr
        Aws.delete_ecr('test_run_multiprocess_in_container_worker')

    @staticmethod
    @pytest.fixture
    def controller_ecr():
        ecr = Aws.get_ecr('test_run_multiprocess_in_container_controller')
        yield ecr
        Aws.delete_ecr('test_run_multiprocess_in_container_controller')

    @staticmethod
    @pytest.fixture
    def cluster():
        yield Ecs.create_cluster('test-run-multiprocess-in-container')
        Ecs.delete_cluster('test-run-multiprocess-in-container')

    @staticmethod
    def run_worker(cluster, subnet, security_group, count=1):
        task = Aws.run(
            f'aws ecs run-task --task-definition test_run_multiprocess_in_container_worker'
            f' --cluster {cluster["clusterArn"]}'
            f' --network-configuration "awsvpcConfiguration={{subnets=[{subnet}],securityGroups=[{security_group}],assignPublicIp=ENABLED}}"'
            f' --launch-type FARGATE --count {count}')
        return json.loads(task)

    @staticmethod
    def run_controller(cluster, subnet, security_group):
        task = Aws.run(
            f'aws ecs run-task --task-definition test_run_multiprocess_in_container_controller'
            f' --cluster {cluster["clusterArn"]} --network-configuration "awsvpcConfiguration={{subnets=[{subnet}],securityGroups=[{security_group}],assignPublicIp=ENABLED}}"'
            f' --launch-type FARGATE')
        return json.loads(task)

    @staticmethod
    def get_tasks(task, cluster):
        task_arns = [t['taskArn'] for t in task['tasks']]
        latest = Aws.run(f'aws ecs describe-tasks --tasks {" ".join(task_arns)} --cluster {cluster["clusterArn"]}')
        return json.loads(latest)

    @staticmethod
    def prepare_controller_task_def(tmp_path, controller_ecr, arg_worker):
        # build docker image for controller
        registryId, repositoryUri, region = controller_ecr
        with open(tmp_path / 'Dockerfile_controller', 'w') as f:
            f.write("""
FROM ubuntu:18.04
EXPOSE 8888
RUN apt-get -y update
RUN apt-get install -y python3
COPY runner/ .
CMD python3 run.py controller
    """)
        proc = subprocess.run("docker build . -f Dockerfile_controller -t test_run_multiprocess_in_container_controller",
                              shell=True, cwd=tmp_path, encoding='utf8')
        assert proc.returncode == 0
        proc = subprocess.run(f'docker tag test_run_multiprocess_in_container_controller:latest {repositoryUri}',
                              shell=True, encoding='utf-8')
        assert proc.returncode == 0
        proc = subprocess.run(f'docker push {repositoryUri}', shell=True, encoding='utf-8')
        assert proc.returncode == 0
        task_def = build_task_definition_controller(f'arn:aws:iam::{registryId}:role/ecsTaskExecutionRole',
                                                    repositoryUri, region, arg_worker)
        task_def_file = tmp_path / 'taskdef_controller.json'
        with open(task_def_file, 'w') as f:
            json.dump(task_def, f)
        registered = Aws.run(f'aws ecs register-task-definition --cli-input-json file://{task_def_file}')
        return json.loads(registered)

    def test_run_multiprocess_in_aws(self, tmp_path, cluster, worker_ecr, controller_ecr):
        env = AwsContainers()
        worker_count = 5
        d = Path(tmp_path)
        env.prepare_docker_contents(d)
        worker_task_def = Ecs.prepare_worker_task_def(d, worker_ecr)

        worker_tasks = self.run_worker(cluster, "subnet-04d6ab48816d73c64", "sg-026a52f114ccf03f3", count=worker_count)
        print('starting workers ...')
        while True:
            time.sleep(5)
            statuses = [t['lastStatus'] for t in self.get_tasks(worker_tasks, cluster)['tasks']]
            print(statuses)
            if all([s == 'RUNNING' for s in statuses]):
                break
            if any([s == 'STOPPED' for s in statuses]):
                assert False

        worker_ips = []
        for t in self.get_tasks(worker_tasks, cluster)['tasks']:
            containers = t['containers']
            ip = containers[0]['networkInterfaces'][0]['privateIpv4Address']
            worker_ips.append(ip)

        arg_worker = ','.join([f'{ip}:50000' for ip in worker_ips])
        print(arg_worker)
        self.prepare_controller_task_def(d, controller_ecr, arg_worker)
        controller_task = self.run_controller(cluster, "subnet-04d6ab48816d73c64", "sg-026a52f114ccf03f3")

        print('starting controller ...')
        while True:
            time.sleep(5)
            statuses = [t['lastStatus'] for t in self.get_tasks(controller_task, cluster)['tasks']]
            print(statuses)
            if all([s == 'RUNNING' for s in statuses]):
                break

        eni_id = [d['value'] for d in self.get_tasks(controller_task, cluster)['tasks'][0]['attachments'][0]['details']
                  if d['name'] == 'networkInterfaceId'][0]
        eni = Aws.run(f'aws ec2 describe-network-interfaces --network-interface-ids {eni_id}')
        controller_ip = json.loads(eni)['NetworkInterfaces'][0]['Association']['PublicIp']
        print('send run command to ' + controller_ip)
        res = urllib.request.urlopen(f'http://{controller_ip}:8888', data=b'run say_hello')
        print('read response')
        result = res.read().decode('utf-8')
        print('send shutdown command')
        res = urllib.request.urlopen(f'http://{controller_ip}:8888', data=b'shutdown')

        assert result == 'Hello, container!' * worker_count

        while True:
            time.sleep(5)
            statuses = [t['lastStatus'] for t in self.get_tasks(worker_tasks, cluster)['tasks']]
            if all([s == 'STOPPED' for s in statuses]):
                break
        while True:
            time.sleep(5)
            statuses = [t['lastStatus'] for t in self.get_tasks(controller_task, cluster)['tasks']]
            if all([s == 'STOPPED' for s in statuses]):
                break

