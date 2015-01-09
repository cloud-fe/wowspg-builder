var fs = require('fs');
var path = require('path');

var scriptReg = /<script[^<]+src=['"]?([^'"]+)['"]? *(handler=['"]?([^'"]+)['"]?)?><\/script>/g;
var linkReg = /(<link.+href=['"]?)([^'"]+)(['"]?.*)(>|\/>|><\/link>)/g;
var dsReg = /(<datasource.+href=['"]?)([^'"]+)(['"]?.*)(>|\/>|><\/datasource>)/g;
var _id = 0;

var _findResource = function(tpl){
    var startHandler = [];
    var readyHandler = [];
    var usableHandler = [];
    var css = [];
    var dataTransfer;
    var dataSource;

    tpl = tpl.replace(
        scriptReg, 
        function(script, src, o, handler, n){
            src = src.replace(/\.js/, '');
            switch (handler){
                case 'start':
                    startHandler.push(src);
                break;
                case 'usable':
                    usableHandler.push(src);
                break;
                case 'dt':
                    dataTransfer = src;
                break;
                default:
                    readyHandler.push(src);
            }
        return '';
    }).replace(
        linkReg,
        function(scr, f, src, kuo,e){
            src = src.replace(/\.less$|\.css$/, '');
            css.push(src);
            return '';
    }).replace(
        dsReg,
        function(scr, f, src, kuo,e){
            dataSource = src;
            return '';
        }
    );

    return {
        tpl: tpl,
        startHandler: startHandler,
        readyHandler: readyHandler,
        usableHandler: usableHandler,
        dataSource: dataSource,
        css: css,
        ds: dataSource,
        dt: dataTransfer
    }
};

var _handler = function(conf, parent, pageConf, env){
    var pageConf = pageConf;
    if (parent && 
        parent.keyword === 'block' && 
        parent.param){
        console.log();
        pageConf.block[parent.param.name] = pageConf.block[parent.param.name] || {};
        pageConf = pageConf.block[parent.param.name];
        pageConf.block = pageConf.block || {};
    }

    // var pageConf = parent ? pageConf
    var params = conf.param;
    var name = params.name;
    var tag = params.tag || 'section';
    var tpl = conf.tpl;
    var fileSrc = env.fileSrc;
    var deps = [];
    var htmlAttr = [];
    var className = '';
    var id = 'wowBlock' + name + _id;
    var tplFileName = 'wow_block_' + path.basename(fileSrc, path.extname(fileSrc)) + '_' + name + _id;
    var filePath = env.output + path.sep + tplFileName + path.extname(env.fileSrc);
    _id++;

    for (var paramName in params){
        if (params.hasOwnProperty(paramName)){
            var param = params[paramName];
            if (paramName === 'deps'){
                paramDeps = param.split(',');
                paramDeps.forEach(function(dep){
                    dep && deps.push(dep);
                });
            } else if (paramName === 'class'){
                className += param;
            } else if (paramName !== 'name' && 
                paramName !== 'tag' &&
                paramName !== 'sync') {
                htmlAttr.push(paramName + '="' + param + '"');
            }
        }
    }
    var blockJson = _findResource(tpl);
    
    if (blockJson.tpl && !params.sync){
        fs.writeFileSync(
            filePath,
            blockJson.tpl,
            {encoding: 'utf8'});
    }

    var blockInfo = pageConf.block[name] = pageConf.block[name] || {};
    var tplSrc = path.relative(env.base, filePath).
            replace(new RegExp(path.sep.replace(/\\/g, '\\\\'), 'g'), '/').
            replace(new RegExp('\\' + path.extname(env.fileSrc) + '$'), '');

    if (blockJson.tpl && !params.sync){
        tplSrc && (blockInfo.tpl = tplSrc);
    } else{
        if (!params.sync){
            blockInfo.tpl = '';
        } else{
            blockInfo.tpl = [
                '<' + tag + ' id="' + id +  '" class="' + className + '" ',
                    htmlAttr.join(' ') + '>',
                    blockJson.tpl,
                '</' + tag + '>'
            ].join('');
        }
    }

    deps.length && (blockInfo.deps = deps);
    blockJson.dt && (blockInfo.dt = blockJson.dt);
    blockJson.css.length && (blockInfo.css = blockJson.css);
    blockJson.ds && (blockInfo.ds = blockJson.ds);

    if (params.sync === 'sync') {
        blockInfo.sync = params.sync;
    } else{
        blockInfo.sync = 'no';
    }

    blockInfo.handler = {};

    blockJson.startHandler.length && (blockInfo.handler.start = blockJson.startHandler);
    blockJson.readyHandler.length && (blockInfo.handler.ready = blockJson.readyHandler);
    blockJson.usableHandler.length && (blockInfo.handler.usable = blockJson.usableHandler);

    if (parent || params.sync){
        pageConf.block[name].selector = '#' + id;
    }
    
    return parent ? [
        '<' + tag + ' id="' + id +  '" class="' + className + '" ',
            htmlAttr.join(' '),
            '></' + tag + '>'
    ].join('') : '';
};

module.exports = {
    key: 'block',
    type: 'double',
    handler: _handler
};