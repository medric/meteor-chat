// Accounts
Accounts.ui.config({
    passwordSignupFields: 'USERNAME_ONLY'
});

// Title
Session.setDefault("title", "Polytalk");
Tracker.autorun(()=>{
    document.title = Session.get("title");
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

function findChannels(fav) {
    var filter = {};

    if(fav) {
        filter.favorites = {$all:[Meteor.userId()]};
    } else {
        filter.favorites = {$not:{$all:[Meteor.userId()]}};
    }

    var searchText = search.get();

    if(searchText != "") {
        filter.name = buildRegExp(searchText);
    }

    return Channels.find(filter, {
        transform: (doc) => {
            doc.isFavorite = fav;
            return doc;
        },
        sort: {
            updated: -1
        }
    });
}

Template.Layout.helpers({
    "favoriteChannels": function() {
        return findChannels.call(this, true);
    },
    "channels": function() {
        return findChannels.call(this, false);
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
    },

    /*"isFavorite": function() {
     return initProfileChannelData(Meteor.user(), this._id).isFavorite;
     },*/

    "isSubscribed": function() {
        return initProfileChannelData(Meteor.user(), this._id).notificationEnabled;
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
    },

    "click .toggle-favorite": function() {
        Meteor.call("toggleChannelFavorite", this._id);
    },

    "click .toggle-notification": function() {
        Meteor.call("toggleChannelNotification", this._id);
    }
});

Template.Channel.helpers({
    "isEmpty": function() {
        return Messages.find({
                channel_id: this._id
            }).count() === 0;
    },

    "messages": function() {
        return Messages.find({
            channel_id: this._id
        }, {
            sort: {
                created: -1
            }
        });
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