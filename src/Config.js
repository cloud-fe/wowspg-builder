var fs = require('fs');
var path = require('path');

var Config = function(base, ld, rd, 
    target, router, entrance, layout,
    dist, isDeleteSource){
    this.base = base || './';
    this.base = path.resolve(this.base);
    this.ld = ld || '{%';
    this.rd = rd || '%}';
    this.target = target || 'router.js';
    this.target = path.resolve(this.target);
    this.router = router;
    this.entrance = entrance || [];
    this.layout = layout;
    this.dist = dist || './dist';
    this.isDeleteSource = isDeleteSource || false;

    if (!fs.existsSync(this.dist)){
        fs.mkdirSync(this.dist);
    }
    this.dist = fs.realpathSync(this.dist);
};

module.exports = Config;