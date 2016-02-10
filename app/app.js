// Collections
Channels = new Mongo.Collection("channels");

// Publications
if(Meteor.isServer) {
    Meteor.publish("channels", function() {
        return Channels.find({}, {
            sort: {
                updated: -1
            }
        });
    });
}

// Subscriptions
if(Meteor.isClient) {
    Meteor.subscribe("channels");
}

// Routes
Router.configure({
    layoutTemplate: "Layout"
});

Router.route("/", function() {
    this.render("Home");
});

Router.route("/channel/:id", function() {
    this.render("Channel", {
        data: () => {
            return Channels.findOne(this.params.id);
        }
    });
    Session.set("currentChannel", this.params.id);
});

displayName = function (user) {
    if (!user)
        return '';

    if (user.profile && user.profile.name)
        return user.profile.name;
    if (user.username)
        return user.username;
    if (user.emails && user.emails[0] && user.emails[0].address)
        return user.emails[0].address;

    return '';
};

// Smart markdown
var imgExts = ["png", "jpg", "jpeg", "bmp", "gif"];

// User Profile channels data
function initProfileChannelData(owner, channel_id) {
    if(!owner.profile) {
        owner.profile = {};
    }

    if(!owner.profile.channels) {
        owner.profile.channels = {};
    }

    if(!owner.profile.channels[channel_id]) {
        owner.profile.channels[channel_id] = {};
    }
}

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
            return Channels.remove({});
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
                messages: []
            });

            return id;
        } else {
            throw new Meteor.Error("Unauthorized");
        }
    },

    "removeChannel": function(channel_id) {
        if(this.userId && Meteor.users.findOne(this.userId).username === "admin") {
            return Channels.remove(channel_id);
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
                created: new Date(),
                content: message_content,
                owner: {
                    _id: owner._id,
                    username: displayName(owner)
                }
            };

            Channels.update(channel_id, {
                $push: {
                    messages: message
                },
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

    "toggleChannelNotification": function(channel_id) {
        updateProfileChannel(this.userId, channel_id, (profile) => {
            profile.notificationEnabled = !profile.notificationEnabled;
        });
    }
});

// Client
if(Meteor.isClient) {
    Accounts.ui.config({
        passwordSignupFields: 'USERNAME_ONLY'
    });

    // Templates
    Blaze.registerHelper("formatDate", function(date) {
        return moment(date).fromNow();
    });

    Blaze.registerHelper("isAdmin", function() {
        if(Meteor.user()) {
            return Meteor.user().username === "admin";
        } else {
            return false;
        }
    });

    var search = new ReactiveVar("");

    function buildRegExp(searchText) {
        var words = searchText.trim().split(/[ \-\:]+/);
        var exps = _.map(words, (word) => {
            return "(?=.*" + word + ")";
        });
        var fullExp = exps.join('') + ".+";
        return new RegExp(fullExp, "i");
    }

    Template.Layout.helpers({
        "channels": function() {
            var filter = {};
            var searchText = search.get();

            if(searchText != "") {
                filter.name = buildRegExp(searchText);
            }

            return Channels.find(filter, {
                sort: {
                    updated: -1
                }
            });
        }
    });

    Template.Layout.events({
        "submit .channel-form": function(event) {
            event.preventDefault();

            var $input = $(event.currentTarget).find(".channel-name");

            Meteor.call("addChannel", $input.val(), (err, result) => {
                if(err) {
                    console.error(err);
                } else {
                    $input.val("");
                    Router.go("/channel/" + result);
                }
            });
        },

        "keyup .channel-search .search-input": _.throttle(function(event) {
            search.set(event.target.value);
        }, 200)
    });

    function hasChannelNewMessage(channel) {
        if(channel.lastMessage) {
            var profile = Meteor.user().profile;
            if (profile && profile.channels) {
                var data = profile.channels[channel._id];
                if (data) {
                    return data.lastRead < channel.lastMessage.created;
                }
            }
        }

        return false;
    }

    Template.ChannelItem.helpers({
        "newMessage": function() {
            return hasChannelNewMessage(this);
        },

        "isSelected": function() {
            return this._id == Session.get("currentChannel");
        }
    });

    Template.ChannelItem.events({
        "click .channel-item": function() {
            Meteor.call("readChannel", this._id);
            Router.go("/channel/" + this._id);
        },

        "click .remove-channel": function() {
            if(confirm("Do you really want to delete this channel and all its messages?")) {
                Meteor.call("removeChannel", this._id, (err) => {
                    if(err) {
                        console.error(err);
                    }
                });
            }
        }
    });

    Template.Channel.helpers({
        "isEmpty": function() {
            return this.messages.length === 0;
        }
    });

    Template.Channel.events({
        "submit .message-form": function(event) {
            event.preventDefault();

            var el = $(event.currentTarget);
            var input = el.find(".message-input");

            var messageContent = input.val();
            input.attr("disabled", true);

            Meteor.call("sendMessage", this._id, messageContent, (err, result) => {
                if(err) {
                    console.error(err);
                } else {
                    input.val("");
                }
                input.attr("disabled", false).focus();
                //scrollToBottom();
            });
        },

        "click .channel": function(event) {
            Meteor.call("readChannel", this._id);
        }
    });

    // Check for new messages
    var handle;
    Tracker.autorun(() => {
        var channel = Channels.find(Session.get("currentChannel"));
        if(!channel) {
            return;
        }

        if(handle) {
            handle.stop();
        }

        handle = channel.observeChanges({
            added: () => {
                Tracker.afterFlush(() => {
                    scrollToBottom();
                });
            },
            changed: (id, fields) => {
                if(fields.messages) {
                    Tracker.afterFlush(() => {
                        scrollToBottom();
                    });
                }
            }
        });
    });

    function scrollToBottom() {
        var $list = $(".messages");
        //console.log("scrolltop is " + $list.scrollTop());
        $list.scrollTop( $list.prop("scrollHeight"));
    }
}