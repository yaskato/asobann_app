tables = None


def get(tablename):
    data = tables.find_one({"tablename": tablename})
    if not data:
        return None
    return data["table"]


def create(tablename):
    table = [
        {
            "name": "drag to move.  double click to flip.  you can share URL.",
            "top": "100px",
            "left": "40px",
            "width": "300px",
            "height": "80px",
            "color": "pink",
            "draggable": True,
            "flippable": False,
            "resizable": True,
            "ownable": False,
            "showImage": False,
            "zIndex": 1,
        },
        {
            "name": "Card 1",
            "top": "175px",
            "left": "0px",
            "width": "150px",
            "height": "200px",
            "draggable": True,
            "flippable": True,
            "resizable": False,
            "ownable": True,
            "faceup": False,
            "showImage": True,
            "faceupImage": "/static/images/v01.jpg",
            "facedownImage": "/static/images/voice_back.png",
            "zIndex": 2,
        },
        {
            "name": "Card 2",
            "top": "175px",
            "left": "150px",
            "width": "150px",
            "height": "200px",
            "draggable": True,
            "flippable": True,
            "resizable": False,
            "ownable": True,
            "faceup": False,
            "showImage": True,
            "faceupImage": "/static/images/v02.jpg",
            "facedownImage": "/static/images/voice_back.png",
            "zIndex": 3,
        },
        {
            "name": "Card 3",
            "top": "250px",
            "left": "0px",
            "width": "150px",
            "height": "200px",
            "draggable": True,
            "flippable": True,
            "resizable": False,
            "ownable": True,
            "faceup": False,
            "showImage": True,
            "faceupImage": "/static/images/v03.jpg",
            "facedownImage": "/static/images/voice_back.png",
            "zIndex": 4,
        },
    ]
    tables.insert_one({"tablename": tablename, "table": table})
    return table


def store(tablename, table):
    tables.update_one(
        {"tablename": tablename},
        {"$set": {"tablename": tablename, "table": table}},
        upsert=True)


def purge_all():
    tables.delete_many({})


def update_component(tablename, index, diff):
    table = get(tablename)
    table[index].update(diff)
    tables.update_one({"tablename": tablename}, {"$set": {"table": table}})


def add_component(tablename, data):
    table = get(tablename)
    table.append(data);
    tables.update_one({"tablename": tablename}, {"$set": {"table": table}})


def connect(mongo):
    global tables
    tables = mongo.db.tables
