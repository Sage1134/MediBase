const sessionID = getLocalStorageItem("sessionID");
const username = getLocalStorageItem("username");
const closeButtons = document.querySelectorAll(".close");
const postButton = document.getElementById("postButton");
const searchButton = document.getElementById("searchButton");
const matches = document.getElementById("matches");
const localIP = "10.200.8.117";
const journalsDiv = document.getElementById("journals");

let tagsList = [];

function clearTagsList() {
    tagsList = [];
}

function addTagToList(tag) {
    if (tag !== "" && !tagsList.includes(tag)) {
        tagsList.push(tag);
    }
}

function removeTagFromList(tag) {
    const index = tagsList.indexOf(tag);
    if (index !== -1) {
        tagsList.splice(index, 1);
    }
}

function closeAllPopups() {
    const popups = document.querySelectorAll(".popup");
    popups.forEach(popup => {
        popup.style.display = "none";
    });
}

searchButton.addEventListener("click", function() {
    clearTagsList();
    document.getElementById("searchTagsContainer").innerHTML = "";
    const searchPopup = document.getElementById("searchPopup");
    searchPopup.style.display = "block";
});

document.getElementById("searchTags").addEventListener("keydown", function(event) {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const tagInput = this.value.trim();
        if (tagInput !== "") {
            if (tagsList.includes(tagInput.toLowerCase())) {
                alert("This tag already exists!");
            }
            else {
                const tagButton = document.createElement("button");
                tagButton.textContent = tagInput;
                tagButton.classList.add("tag-button");
                tagButton.addEventListener("click", function() {
                    removeTagFromList(tagButton.textContent);
                    this.remove();
                });
                document.getElementById("searchTagsContainer").appendChild(tagButton);
                addTagToList(tagButton.textContent.toLowerCase());
                this.value = "";
            }
        }
    }
});

document.getElementById("searchSubmitBtn").addEventListener("click", function() {
    if (tagsList.length > 0) {
        const socket = new WebSocket("ws://" + localIP + ":1134");

        const data = {
            purpose: "searchPosts",
            username: username,
            sessionToken: sessionID,
            tags: tagsList
        };
        
        socket.onopen = function(event) {
            socket.send(JSON.stringify(data));
        };

        socket.onmessage = function(event) {
            const data = JSON.parse(event.data);

            if (data.purpose === "searchSuccess") {
                closeAllPopups();
                journalsDiv.innerHTML = "";

                data.matches.forEach(post => {
                    const postElement = document.createElement("div");
                    postElement.classList.add("post-box");

                    const titleElement = document.createElement("h2");
                    titleElement.textContent = post.title;

                    const descriptionElement = document.createElement("p");
                    descriptionElement.textContent = post.description;

                    const tagsElement = document.createElement("p");
                    tagsElement.textContent = "Tags: " + post.tags.join(", ");

                    postElement.appendChild(titleElement);
                    postElement.appendChild(descriptionElement);
                    postElement.appendChild(tagsElement);

                    journalsDiv.appendChild(postElement);
                });
            } else if (data.purpose === "missingTags") {
                alert("Include at least one tag in your search.");
            } else if (data.purpose === "missingPosts") {
                alert("No journals exist! Consider posting something.");
            } else if (data.purpose === "noMatchesFound") {
                alert("No matching journals found!");
            } else if (data.purpose === "fail") {
                alert("Session Invalid Or Expired");
                window.location.href = "../SignIn/SignIn.html";
            }

            socket.close(1000, "Closing Connection");
        };
    } else {
        alert("Please enter some tags to search.");
    }
});



postButton.addEventListener("click", function() {
    clearTagsList();
    document.getElementById("tagsContainer").innerHTML = "";
    const postPopup = document.getElementById("postPopup");
    postPopup.style.display = "block";
});

closeButtons.forEach(button => {
    button.addEventListener("click", function() {
        button.closest(".popup").style.display = "none";
    });
});

async function fetchPosts() {
    const socket = new WebSocket("ws://" + localIP + ":1134");

    const data = {
        purpose: "getPosts",
        username: username,
        sessionToken: sessionID,
    };

    socket.onopen = function(event) {
        socket.send(JSON.stringify(data));
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);

        if (data.purpose === "fetchPostsSuccess") {
            const journalsDiv = document.getElementById("journals");
            journalsDiv.innerHTML = "";

            data.posts.forEach(post => {
                const postElement = document.createElement("div");
                postElement.classList.add("post-box");

                const titleElement = document.createElement("h2");
                titleElement.textContent = post.title;

                const descriptionElement = document.createElement("p");
                descriptionElement.textContent = post.description;

                const tagsElement = document.createElement("p");
                tagsElement.textContent = "Tags: " + post.tags.join(", ");

                postElement.appendChild(titleElement);
                postElement.appendChild(descriptionElement);
                postElement.appendChild(tagsElement);

                journalsDiv.appendChild(postElement);
            });
        } else {
            alert("Failed to fetch posts or session expired.");
            window.location.href = "../SignIn/SignIn.html";
        }

        socket.close(1000, "Closing Connection");
    };
}

document.addEventListener("DOMContentLoaded", function() {
    fetchPosts();
});

postSubmitBtn.addEventListener("click", function() {
    const postTitle = document.getElementById("postTitle").value.trim();
    const postDescription = document.getElementById("postDescription").value.trim();

    if (postTitle && postDescription) {
        const socket = new WebSocket("ws://" + localIP + ":1134");
        const data = {
            purpose: "createPost",
            username: username,
            sessionToken: sessionID,
            postTitle: postTitle,
            postDescription: postDescription,
            tags: tagsList
        };

        socket.onopen = function(event) {
            socket.send(JSON.stringify(data));
        };

        document.getElementById("postTitle").value = "";
        document.getElementById("postDescription").value = "";
        document.getElementById("postTags").value = "";

        socket.onmessage = function(event) {
            var data = JSON.parse(event.data);
            if (data.purpose == "postSuccess") {
                closeAllPopups();
                clearTagsList();
                document.getElementById("tagsContainer").innerHTML = "";
            } else if (data.purpose == "fail") {
                alert("Session Invalid Or Expired");
                window.location.href = "../SignIn/SignIn.html";
            }

            socket.close(1000, "Closing Connection");
        };
    } else {
        alert("Please fill in all required fields.");
    }
});

document.getElementById("postTags").addEventListener("keydown", function(event) {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const tagInput = this.value.trim();
        if (tagInput !== "") {
            if (tagsList.includes(tagInput.toLowerCase())) {
                alert("This tag already exists!");
            }
            else {
                const tagButton = document.createElement("button");
                tagButton.textContent = tagInput;
                tagButton.classList.add("tag-button");
                tagButton.addEventListener("click", function() {
                    removeTagFromList(tagButton.textContent);
                    this.remove();
                });
                document.getElementById("tagsContainer").appendChild(tagButton);
                addTagToList(tagButton.textContent.toLowerCase());
                this.value = "";
            }
        }
    }
});

document.getElementById("signOutButton").addEventListener("click", function() {
    const socket = new WebSocket("ws://" + localIP + ":1134");

    const data = {
        purpose: "signOut",
        username: username,
        sessionToken: sessionID,
    };

    socket.onopen = function(event) {
        socket.send(JSON.stringify(data));
    };

    socket.onmessage = function(event) {
        var data = JSON.parse(event.data);
        if (data.purpose == "fail") {
            alert("Session Invalid Or Expired");
            window.location.href = "../SignIn/SignIn.html";
        } else if (data.purpose == "signOutSuccess") {
            localStorage.removeItem("username");
            localStorage.removeItem("sessionID");
            window.location.href = "../SignIn/SignIn.html";
        }
        socket.close(1000, "Closing Connection");
    };
});

searchButton.addEventListener("click", function() {
        const socket = new WebSocket("ws://" + localIP + ":1134");

        const data = {
            purpose: "search",
            username: username,
            sessionToken: sessionID,
        };

        socket.onopen = function(event) {
            socket.send(JSON.stringify(data));
        };

        socket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            if (data.purpose === "searchSuccess") {
                closeAllPopups();
                matches.innerHTML = "";
                linkPopup.style.display = "Block";

                data.matches.forEach(match => {
                    const matchElement = document.createElement("div");
                    matchElement.classList.add("post-box");
                    matchElement.classList.add("link-box");
            
                    const titleElement = document.createElement("h2");
                    titleElement.textContent = match.title;
            
                    const descriptionElement = document.createElement("p");
                    descriptionElement.textContent = match.description;
            
                    const tagsElement = document.createElement("p");
                    tagsElement.textContent = "Tags: " + match.tags.join(", ");

                    const scoreElement = document.createElement("p");

                    scoreElement.textContent = "Match Score: " + (match.score * 100).toFixed(2) + "%";
            
                    matchElement.appendChild(titleElement);
                    matchElement.appendChild(descriptionElement);
                    matchElement.appendChild(tagsElement);
                    matchElement.appendChild(scoreElement);
            
                    matches.appendChild(matchElement);
                });
            } else if (data.purpose == "missingTags") {
                alert("Add some tags to your profile first!")
            } else if (data.purpose == "missingPosts") {
                alert("No posts found in this community! Consider posting something.")
            } else if (data.purpose == "noMatchesFound") {
                alert("No matches found in this community!")
            } else if (data.purpose == "fail") {
                alert("Session Invalid Or Expired");
                window.location.href = "../signIn/signIn.html";
            }
            socket.close(1000, "Closing Connection");
        };
    }
)

document.addEventListener("DOMContentLoaded", function() {
    fetchPosts();
});

function setLocalStorageItem(key, value) {
    localStorage.setItem(key, value);
}

function getLocalStorageItem(key) {
    return localStorage.getItem(key);
}