Meteor.publish("channels", function() {
    return Channels.find({}, {
        sort: {
            updated: -1
        }
    });
});

Meteor.publish("messages", function(channel_id) {
    return Messages.find({
        channel_id
    });
});