import os

if 'REDIS_URI' in os.environ:
    REDIS_URI = os.environ['REDIS_URI']
else:
    REDIS_URI = None

MONGO_URI = 'mongodb://localhost:27017/ex2test'
PORT = 10011

BASE_URL = 'http://localhost:5000'

if 'GOOGLE_ANALYTICS_ID' in os.environ:
    GOOGLE_ANALYTICS_ID = os.environ['GOOGLE_ANALYTICS_ID']
else:
    GOOGLE_ANALYTICS_ID = None
