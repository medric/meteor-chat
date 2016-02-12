// Routes
Router.configure({
    layoutTemplate: "Layout",
    loadingTemplate: "Loading",
    fastRender: true
});

Router.route("/", function() {
    this.render("Home");
    if(Meteor.isClient) {
        Session.set("title", "Polytalk");
        Session.set("currentChannel", null);
    }
}, {
    waitOn: function() {
        return  [
            Meteor.subscribe("channels")
        ]
    }
});

Router.route("/channel/:id", function() {
    this.render("Channel", {
        data: () => {
            return Channels.findOne(this.params.id);
        }
    });
    if(Meteor.isClient) {
        var data = Channels.findOne(this.params.id);
        Session.set("currentChannel", this.params.id);
        Session.set("title", data.name);
    }
}, {
    waitOn: function() {
        return [
            Meteor.subscribe("channels"),
            Meteor.subscribe("messages", this.params.id)
        ]
    }
});