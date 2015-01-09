var fs = require('fs');
var path = require('path');
var Config = require('./Config.js');
var routerParser = require('./router_parser.js');

var config;

var _readDir = function(src, ext){
    var isPathExists = fs.existsSync(src);
    if (isPathExists){
        var realPath =fs.realpathSync(src);
        var sta = fs.statSync(realPath);
        if (sta.isFile()){
            srcList.push(realPath + ext);
        } else if (sta.isDirectory()){
            var dirs = fs.readdirSync(src);
            dirs.forEach(function(dirName, index){
                _readDir(realPath + path.sep + dirName, ext);
            });
        }
    }
};

var _renderInfo = {};
var _renderIndex = 0;

var _renderPage = function(router, tpl, childRouter, cb){
    var parentRouter = {};
    if (childRouter){
        parentRouter = {
            block: {},
            router: {}
        }
        if (childRouter.layout){
            if (_renderInfo[childRouter.layout]){
                parentRouter = _renderInfo[childRouter.layout];
            }
            parentRouter.reg = parentRouter.reg ? parentRouter.reg + '|' + childRouter.reg : childRouter.reg;
            parentRouter.router[childRouter.reg] = {
                title: childRouter.title,
                block: childRouter.block
            };
        }
    }
    if (_renderInfo[tpl]){
        _renderIndex++;
        return;
    }
    _renderInfo[tpl] = parentRouter;

    routerParser.parse(tpl, config, function(pageConf){
        parentRouter.title = pageConf.title;
        parentRouter.block = pageConf.block;
        pageConf.spgVar && (parentRouter.spgVar = pageConf.spgVar);
        if (router !== null){
            parentRouter.reg = router;
        }
        if (pageConf.layout && pageConf.layout !== 'outer'){
            parentRouter.layout = pageConf.layout;
            _renderPage(null, pageConf.layout, parentRouter, cb);
        } else{
            _renderIndex++;
            cb && cb(parentRouter);
        }
    });
};

var _render = function(cb){
    var routerConfig = config.router;
    var entrances = config.entrance;
    var baseLayout = config.layout;
    var baseLayoutConf;
    var flagBaseLoaded = !baseLayout ? true : false;
    var rendercount = 0;
    var layouts = [];
    var flagRouterLoaded = false;

    for (var router in routerConfig) {
        rendercount++;
    }

    for (var router in routerConfig) {
        var tpl = routerConfig[router];
        if (path.extname(tpl) === ''){
            layouts.push({
                reg: router,
                router: tpl
            });
            _renderIndex++;
            if (_renderIndex >= rendercount){
                flagRouterLoaded = true;
                _renderIndex = 0;
                if (flagRouterLoaded && flagBaseLoaded){
                    cb && cb(layouts, baseLayoutConf);
                }
            }
            continue;
        }

        _renderPage(router, tpl, null, function(layout){
            layouts.push(layout);
            if (_renderIndex >= rendercount){
                flagRouterLoaded = true;
                _renderIndex = 0;
                if (flagRouterLoaded && flagBaseLoaded){
                    cb && cb(layouts, baseLayoutConf);
                }
            }
        });
    }
    
    if (baseLayout){
        var layoutReg = '.*';
        var tpl = baseLayout;
        if (path.extname(tpl) === ''){
            baseLayoutConf = {
                reg: layoutReg,
                router: tpl
            };
        } else{
            _renderPage(layoutReg, tpl, null, function(layout){
                baseLayoutConf = layout;
                flagBaseLoaded = true;
                if (flagRouterLoaded && flagBaseLoaded){
                    cb && cb(layouts, baseLayoutConf);
                }
            });
        }
    }
};

var _mkdir = function(dirpath, mode){
    if (!fs.existsSync(dirpath)) {
        var pathtmp;
        dirpath.split(path.sep).forEach(function(dirname) {
            if (!dirname){
                pathtmp = '/';
            }
            if (pathtmp) {
                pathtmp = path.join(pathtmp, dirname);
            }
            else {
                pathtmp = dirname;
            }

            if (!fs.existsSync(pathtmp)) {
                if (!fs.mkdirSync(pathtmp, mode)) {
                    return false;
                }
            }
        });
    }
};

var _renderEntrance = function(routerConf, layouts, cb){
    var entrances = config.entrance;
    var entranceRenderCount = 0;

    entrances.forEach(function(entrance, index){
        var entRouter;
        if (layouts.length > 1){
            entRouter = routerConf.router;
        } else{
            entRouter = {};
            entRouter[layouts[0].reg] = routerConf;
        }
        var reg = '.*';
        var routerInline = {};
        routerInline[reg] = {
            router: entRouter
        };

        _renderPage(reg, entrance.tpl, null, function(entranceInfo){
            entranceRenderCount++;
            if (entranceRenderCount >= entrances.length){
                entranceInfo.block && (routerInline[reg].block = entranceInfo.block);
                entranceInfo.title && (routerInline[reg].title = entranceInfo.title);
                
                var entranceTpl = fs.readFileSync(path.join(config.base, entrance.tpl), {
                        encoding: 'utf8'
                    });
                entranceTpl = entranceTpl.replace(new RegExp([
                    config.ld,
                        'block(((?!' + config.rd + ')[\\s\\S])+[\\s\\S])',
                    config.rd,
                        '(((?!' + config.rd + ')[\\s\\S])*)',
                    config.ld,
                        '/block',
                    config.rd
                    ].join(''), 'g'), function(src, attr){

                    var args = /name=['"]?([^'"]+)['"]?/.exec(attr);
                    var blockName = args[1];
                    if (blockName && entranceInfo.block[blockName]){
                        var backTpl = entranceInfo.block[blockName].tpl;
                        entranceInfo.block[blockName].tpl = '';
                        return backTpl;
                    }
                }).replace(new RegExp([
                    config.ld,
                        'spgmain(((?!' + config.rd + ')[\\s\\S])+[\\s\\S])',
                    config.rd].join('')), function(){
                    return [
                        '<script>',
                            'window.' + entranceInfo.spgVar + '=',
                            JSON.stringify(routerInline) + ';',
                        '</script>'
                    ].join('');
                });

                var distDir = path.dirname(entrance.dist);
                _mkdir(distDir);

                fs.writeFileSync(entrance.dist, entranceTpl, {
                    encoding: 'utf8'
                });

                cb && cb(entranceInfo);
            }
        });
    });
};

var _compile = function(options, cb){
    var opt = options || {};
    config = new Config(opt.base, 
        opt.ld, opt.rd, 
        opt.target, opt.router, opt.entrance, opt.layout,
        opt.dist, opt.isDeleteSource);

    _renderInfo = {};
    _renderIndex = 0;
    _render(function(layouts, baseLayout){
        var routerConf;
        if (layouts.length > 1){
            routerConf = {
                router: {}
            };
            layouts.forEach(function(layout){
                if (typeof layout.router === 'string'){
                    routerConf.router[layout.reg] = layout.router;
                } else{
                    routerConf.router[layout.reg] = {
                        title: layout.title,
                        block: layout.block,
                        router: layout.router
                    }
                }

            });
        } else{
            var layout = layouts[0];
            
            if (typeof layout.router === 'string'){
                routerConf = {
                    router: {}
                };
                routerConf.router[layout.reg] = layout.router;
            } else{
                routerConf = {
                    title: layout.title,
                    block: layout.block,
                    router: layout.router
                };
            }
        }
        if (baseLayout){
            var oriRouterConf = routerConf;
            routerConf = {
                block: baseLayout.block,
                router: oriRouterConf.router
            };
        }

        if (config.entrance && config.entrance.length){
            _renderEntrance(routerConf, layouts, function(entranceInfo){
                console.log('Wow Spg Compiled!');
                cb && cb();
            });
        } else{
            
            var routerDir = path.dirname(config.target);

            _mkdir(routerDir);

            //compile OK 
            fs.writeFileSync(config.target, [
                'define(function() {',
                    'return ' + JSON.stringify(routerConf) + ';',
                '});'
            ].join(''), {
                encoding: 'utf8'
            });

            console.log('Wow Spg Compiled!');
            cb && cb();
        }
    });
};

module.exports = {
    compile : _compile
}; 