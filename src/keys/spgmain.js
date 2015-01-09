var _handler = function(conf, parent, pageConf){
    var params = conf.param;

    pageConf.spgVar = params['var'] || 'wowSpgRouterConfig';
};

module.exports = {
    key: 'extend',
    type: 'single',
    handler: _handler
};