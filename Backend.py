from pymongo import MongoClient
from dotenv import load_dotenv
import os
import websockets
import asyncio
import json
import hashlib
import uuid
from gensim.models import Word2Vec

matchModel = Word2Vec.load("MatchModel/MatchModel.model")

load_dotenv("Vars.env")

uri = os.environ.get("MONGODB_URI")
ip = os.environ.get("BackendIP")
port = os.environ.get("Port")

client = MongoClient(uri)
database = client["MediBase"]
collection = database["MediBaseData"]

connectedClients = set()
sessionTokens = dict()

async def addSessionToken(username, token):
    sessionTokens[username] = token

    async def expireToken():
        await asyncio.sleep(86400)
        if username in sessionTokens.keys() and sessionTokens[username] == token:
            del sessionTokens[username]

    asyncio.create_task(expireToken())

def determineSimilarity(w1, w2):
    try:
        return matchModel.wv.similarity(w1=w1, w2=w2)
    except:
        return 0.25

def calculateMatchScore(setA, setB):
    matchScores = []
    for i in setA:
        currentTermScores = []
        for j in setB:
            currentTermScores.append(determineSimilarity(i, j))
        if len(currentTermScores) > 0:
            matchScores.append(max(currentTermScores))
    if len(matchScores) == 0:
        return 0
    return min((sum(matchScores) / len(matchScores)) * 1.15, 1)

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
        data = await client_socket.recv()
        data = json.loads(data)
        
        if data["purpose"] == "registration":
            await register(client_socket, data)
        elif data["purpose"] == "signIn":
            await signIn(client_socket, data)
        elif data["purpose"] == "createPost":
            await createPost(client_socket, data)
        elif data["purpose"] == "getPosts":
            await getPosts(client_socket, data)
        elif data["purpose"] == "searchPosts":
            await searchPosts(client_socket, data)
    except:
        pass

async def searchPosts(client_socket, data):
    try:
        sessionID = data["sessionToken"]
        username = data["username"]
        
        if username in sessionTokens.keys() and sessionTokens[username] == sessionID:
            matches = []
            posts = getData(["Posts"]) 
            tags = data.get("tags", []) 
            
            if not tags: 
                data = {"purpose": "missingTags"}
            elif not posts:
                data = {"purpose": "missingPosts"}
            else:
                for post in posts:
                    score = calculateMatchScore(tags, post.get("tags", [])) 
                    if score >= 0.6:
                        post["score"] = score
                        matches.append(post)
                
                if not matches:
                    data = {"purpose": "noMatchesFound"}
                else:
                    data = {"purpose": "searchSuccess", "matches": matches}
        else:
            data = {"purpose": "fail"}
        
        await client_socket.send(json.dumps(data))
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if client_socket in connectedClients:
            connectedClients.remove(client_socket)


async def getPosts(client_socket, data):
    try:
        sessionID = data["sessionToken"]
        username = data["username"]

        if username in sessionTokens.keys() and sessionTokens[username] == sessionID:
            currentPosts = getData(["Posts"])

            if currentPosts is None:
                currentPosts = []

            data = {
                "purpose": "fetchPostsSuccess",
                "posts": currentPosts
            }
        else:
            data = {"purpose": "fail"}

        await client_socket.send(json.dumps(data))
    except:
        pass
    finally:
        connectedClients.remove(client_socket)
    
async def createPost(client_socket, data):
    try:
        sessionID = data["sessionToken"]
        username = data["username"]
        title = data["postTitle"]
        description = data["postDescription"]
        tags = data["tags"]
        
        if username in sessionTokens.keys():
            if sessionTokens[username] == sessionID:
                currentPosts = getData(["Posts"])
                if currentPosts is None:
                    currentPosts = []
                
                for i in enumerate(tags):
                    tags[i[0]] = i[1].lower()
                    if len(i[1]) > 36:
                        tags[i[0]] = i[1][0:36]

                uniqueTags = []

                for tag in tags:
                    if tag not in uniqueTags:
                        uniqueTags.append(tag)
                
                if len(title) > 36:
                    title = title[0:36]
                
                if len(description) > 1000:
                    description = description[0:1000]
                
                post = {"title": title, "description": description, "tags": uniqueTags}
               
                currentPosts.append(post)
                
                setData(["Posts"], currentPosts)
                
                data = {"purpose": "postSuccess"}
            else:
                data = {"purpose": "fail"}
        else:
            data = {"purpose": "fail"}
        await client_socket.send(json.dumps(data))
    except:
        pass
    finally:
        connectedClients.remove(client_socket)

async def register(client_socket, data):
    try:
        username = data["username"]
        password = data["password"]

        if getData(["Credentials", username]) == None:
            hash_object = hashlib.sha256()
            hash_object.update(password.encode())
            hashed_password = hash_object.hexdigest()
            setData(["Credentials", username, "password"], hashed_password)
            
            data = {"purpose": "registerResult",
                    "result": "Registration Successful! Please Sign In."}
        else:
            data = {"purpose": "registerResult",
                    "result": "Username Already Taken!"}
        await client_socket.send(json.dumps(data))
    except:
        pass
    finally:
        connectedClients.remove(client_socket)

async def signIn(client_socket, data):
    try:
        username = data["username"]
        password = data["password"]

        hash_object = hashlib.sha256()
        hash_object.update(password.encode())
        hashed_password = hash_object.hexdigest()
        
        if getData(["Credentials", username, "password"]) == hashed_password:
            sessionToken = str(uuid.uuid4())
            await addSessionToken(username, sessionToken)
            data = {"purpose": "success",
                "sessionToken": sessionToken,
                "redirect": "../Dashboard/Dashboard.html"}
        else:
            data = {"purpose": "fail"}
        await client_socket.send(json.dumps(data))
    except:
        pass
    finally:
        connectedClients.remove(client_socket)

async def startServer():
    print("Server Started")
    await websockets.serve(newClientConnected, ip, port)

event_loop = asyncio.get_event_loop()
event_loop.run_until_complete(startServer())
event_loop.run_forever()