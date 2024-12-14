from pymongo import MongoClient
from dotenv import load_dotenv
import os
import websockets
import asyncio

load_dotenv("Vars.env")

uri = os.environ.get("MONGODB_URI")
ip = os.environ.get("BackendIP")
port = os.environ.get("Port")

client = MongoClient(uri)
database = client["MediBase"]
collection = database["MediBaseData"]

connectedClients = set()

def getData(path):
    data = collection.find()

    for document in data:
        if document["_id"] == path[0]:
            data = document
            break
    else:
        return None

    for key in path:
        if key in data.keys():
            data = data[key]
        else:
            return None
        
    return data

def setData(path, data):
    newData = collection.find_one({"_id":path[0]})
    if newData != None:
        newData = dict(newData)
        dataUpdate = newData
        
        for key in enumerate(path):
            if key[0] != len(path) - 1:
                if key[1] in dataUpdate.keys():
                    if isinstance(dataUpdate[key[1]], dict):
                        dataUpdate = dataUpdate[key[1]]
                    else:
                        dataUpdate[key[1]] = {}
                        dataUpdate = dataUpdate[key[1]]
                else:
                    dataUpdate[key[1]] = {}
                    dataUpdate = dataUpdate[key[1]]
        dataUpdate[path[-1]] = data
        collection.find_one_and_replace({"_id":path[0]}, newData)

    else:
        newData = {}
        dataUpdate = newData
        
        for key in enumerate(path):
            dataUpdate[key[1]] = {}
            if (key[0] != len(path) - 1):
                dataUpdate = dataUpdate[key[1]]
        dataUpdate[path[-1]] = data

        newData["_id"] = path[0]
        collection.insert_one(newData)

def delData(path):
    data = collection.find()

    target = path.pop()

    for document in data:
        if len(path) != 0:
            if document["_id"] == path[0]:
                doc = document
                data = doc
                for key in path:
                    if key in data.keys():
                        data = data[key]
                if target in data.keys():
                    del data[target]
                
                collection.find_one_and_replace({"_id":path[0]}, doc)
                break
        else:
            collection.delete_one({"_id":target})

async def newClientConnected(client_socket):
    try:
        connectedClients.add(client_socket)
    except:
        pass


async def startServer():
    print("Server Started")
    await websockets.serve(newClientConnected, ip, port)

event_loop = asyncio.get_event_loop()
event_loop.run_until_complete(startServer())
event_loop.run_forever()