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

// Methods
Meteor.methods({
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

    "sendMessage": function(channel_id, message_content) {
        if(this.userId) {
            var owner = Meteor.users.findOne(this.userId);

            var message = {
                created: new Date(),
                content: message_content,
                owner: {
                    _id: owner._id,
                    username: owner.username
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
        if(this.userId) {
            var owner = Meteor.users.findOne(this.userId);
            if(!owner) {
                return;
            }

            if(!owner.profile) {
                owner.profile = {};
            }

            if(!owner.profile.channels) {
                owner.profile.channels = {};
            }

            if(!owner.profile.channels[channel_id]) {
                owner.profile.channels[channel_id] = {};
            }

            owner.profile.channels[channel_id].lastRead = new Date();

            Meteor.users.update(this.userId, {
                $set: {
                    profile: owner.profile
                }
            });
        }
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

    Template.Layout.helpers({
        "channels": function() {
            return Channels.find();
        }
    });

    Template.Layout.events({
        "submit .channel-form": function(event) {
            event.preventDefault();

            Meteor.call("addChannel", $(event.currentTarget).find(".channel-name").val(), (err, result) => {
                if(err) {
                    console.error(err);
                } else {
                    Router.go("/channel/" + result);
                }
            });
        }
    })

    Template.ChannelItem.helpers({
        "newMessage": function() {
            var profile = Meteor.user().profile;
            if(profile && profile.channels) {
                var data = profile.channels[this._id];
                if (data) {
                    return data.lastRead < this.lastMessage.created;
                }
            }

            return false;
        },

        "isSelected": function() {
            return this._id == Session.get("currentChannel");
        }
    });

    Template.ChannelItem.events({
        "click .channel-item": function() {
            Meteor.call("readChannel", this._id);
            Router.go("/channel/" + this._id);
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
        console.log("scrolltop is " + $list.scrollTop());
        $list.scrollTop( $list.prop("scrollHeight"));
    }
}