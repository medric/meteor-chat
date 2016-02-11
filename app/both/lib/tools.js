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

// User Profile channels data
initProfileChannelData = function (owner, channel_id) {
    if(!owner.profile) {
        owner.profile = {};
    }

    if(!owner.profile.channels) {
        owner.profile.channels = {};
    }

    if(!owner.profile.channels[channel_id]) {
        owner.profile.channels[channel_id] = {};
    }

    return owner.profile.channels[channel_id];
}