// Smart markdown
var imgExts = ["png", "jpg", "jpeg", "bmp", "gif"];

function updateProfileChannel(userId, channel_id, modifier) {
    if(userId) {
        var owner = Meteor.users.findOne(userId);
        if (!owner) {
            return;
        }

        initProfileChannelData(owner, channel_id);

        modifier(owner.profile.channels[channel_id]);

        Meteor.users.update(userId, {
            $set: {
                profile: owner.profile
            }
        });
    }
}

// Methods
Meteor.methods({
    "clearChannels": function() {
        if(this.userId && Meteor.users.findOne(this.userId).username === "admin") {
            Messages.remove({});
            Channels.remove({});
        } else {
            throw new Meteor.Error("Unauthorized");
        }
    },

    "addChannel": function(name) {
        if(this.userId) {
            var id = Channels.insert({
                name,
                created: new Date(),
                updated: new Date(),
                lastMessage: null,
                favorites: [],
                subscribers: []
            });

            return id;
        } else {
            throw new Meteor.Error("Unauthorized");
        }
    },

    "removeChannel": function(channel_id) {
        if(this.userId && Meteor.users.findOne(this.userId).username === "admin") {
            Messages.remove({
                channel_id
            });
            Channels.remove(channel_id);
        } else {
            throw new Meteor.Error("Unauthorized");
        }
    },

    "sendMessage": function(channel_id, message_content) {
        if(this.userId) {
            var owner = Meteor.users.findOne(this.userId);

            // Smart markdown
            var urlReg = /(http(s)?\:\/\/[a-z0-9\/\-_%.]+)/gi;
            if(urlReg.test(message_content)) {
                // File extension
                let index = message_content.lastIndexOf(".");
                if(index != -1) {
                    let ext = message_content.substr(index+1);
                    // Url type detection
                    if(ext && imgExts.indexOf(ext.toLowerCase()) != -1) {
                        // Image
                        message_content = "![image](" + message_content + ")";
                    } else {
                        // Link
                        message_content = "[" + message_content + "](" + message_content + ")";
                    }
                }
            }

            var message = {
                channel_id: channel_id,
                created: new Date(),
                content: message_content,
                owner: {
                    _id: owner._id,
                    username: displayName(owner)
                }
            };

            Messages.insert(message);

            Channels.update(channel_id, {
                $set: {
                    lastMessage: message,
                    updated: new Date()
                }
            });

            Meteor.call("readChannel", channel_id);
        } else {
            throw new Meteor.Error("Unauthorized");
        }
    },

    "readChannel": function(channel_id) {
        updateProfileChannel(this.userId, channel_id, (profile) => {
            profile.lastRead = new Date();
        });
    },

    "toggleChannelFavorite": function(channel_id) {
        updateProfileChannel(this.userId, channel_id, (profile) => {
            profile.isFavorite = !profile.isFavorite;

            // Channel subscribers
            if(profile.isFavorite) {
                Channels.update(channel_id, {
                    $addToSet : {
                        favorites: this.userId
                    }
                });
            } else {
                Channels.update(channel_id, {
                    $pull : {
                        favorites: this.userId
                    }
                });
            }
        });
    },

    "toggleChannelNotification": function(channel_id) {
        updateProfileChannel(this.userId, channel_id, (profile) => {
            profile.notificationEnabled = !profile.notificationEnabled;

            // Channel subscribers
            if(profile.notificationEnabled) {
                Channels.update(channel_id, {
                    $addToSet : {
                        subscribers: this.userId
                    }
                });
            } else {
                Channels.update(channel_id, {
                    $pull : {
                        subscribers: this.userId
                    }
                });
            }
        });
    }
});