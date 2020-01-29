(function($N){$N[0][$N[1]]=(function($N){
function packageTemplate(){(function($N){$N[0][$N[1]]=(function acme_package(){})(!$N[0].Document);})(typeof process+typeof module+typeof require==='objectobjectfunction'?[module,"exports"]:[window,"${acme}"]);}
function multiPackageTemplate(){(function($N){$N[0][$N[1]]=(function acme_package(){})(!$N[0].Document);})([typeof process+typeof module+typeof require==='objectobjectfunction'?module.exports:window,"${acme}"]);}
function multiPackageTemplate2(){(function($N){$N["${acme}"]=(function acme_package(){})(!$N.Document);})(typeof process+typeof module+typeof require==='objectobjectfunction'?module.exports:window);}


    var
    path = require("path"),
    fs =require("fs"),
    UglifyJS     = require("uglify-js"),
    babel = require("babel-core"),
    minifyJS = function minifyJS( js_src ) {
       var result1= UglifyJS.minify(js_src, {
           parse: {},
           compress: {},
           mangle: false,
           comments:false,
           output: {
               code: true
           }
       });

       var result2 = babel.transform(js_src,{minified:true,comments:false});


       if (!result1.code) return result2.code;

       return  (result1.code.length < result2.code.length) ? result1.code : result2.code;
    };

    function isPreloaded(fn) {
        switch (typeof fn) {
            case 'string' : return false;
            case 'object' : return true;
            case 'function':
                if (fn.name!=='' || Object.keys(fn)>0|| fn.length>0) return true;
        }
        return false;
    }

    function nodify(fn,comment){
        return (function () {
                    var fkmod = {exports:{}};
                    (function (process,module,require) {
                        //code
                    })({env:{},cwd:function(){return"/"}},fkmod,function(){return {};});
                    return fkmod.exports;
                }).toString().split('//code').join("\n/*"+comment+"*/"+fn.toString()+"\n");
    }


    function build (filename,moduleName) {

            var pkg_filename;
            var min_filename;


            var isList = typeof filename === 'object' && filename.mod && filename.js,
                listIndex,list;

            if (isList) {
                moduleName   = filename.mod;
                filename     = filename.js;
                pkg_filename = filename.pkg;
                min_filename = filename.min;
                listIndex =arguments[1];
                list=arguments[2];
            } else {
                moduleName  = typeof moduleName==='string' ? moduleName : def_mod_name(filename);
            }

            if (!filename) {
                if(!process.mainModule) {
                    return console.log("usage: build(filename,moduleName)");
                }
                throw new Error ("incorrect arguments passed to build");
            }





            var js_source, preloaded=false;

            //todo: use vm with sandbox here.
            js_source=require(filename);

            if (typeof js_source!=='function') {
                js_source = fs.readFileSync(filename,"utf8").trim();
                js_source = js_source.substr(0,js_source.lastIndexOf('}'));
                if(!process.mainModule) {
                    console.log("loaded module as string:",js_source.length,"chars");
                }
            } else {
                preloaded=isPreloaded(js_source);
                if ( preloaded ) {
                    js_source = nodify(fs.readFileSync(filename,"utf8"),'injected:'+filename);

                    if(!process.mainModule) {
                        console.log("detected preloaded module, embeding raw source:",js_source.toString().length,"chars");
                    }
                } else {
                    if(!process.mainModule) {
                        console.log("detected exported function:",js_source.toString().length,"chars");
                    }
                }

            }

            pkg_filename = pkg_filename || filename.replace(/\.js$/,'.pkg.js') ;
            min_filename = min_filename || filename.replace(/\.js$/,'.min.js') ;

            var result = {
                js   : js_source,
                name : moduleName,
                file : filename,
                preloaded : preloaded ? js_source : false,
                pkg  : { file : pkg_filename},
                min  : { file : min_filename},
            };

            js_source = makePackage(moduleName,js_source);
            fs.writeFileSync(pkg_filename ,js_source);
            if(!process.mainModule) {
                console.log("wrote:",pkg_filename);
                console.log("packaged source:",js_source.length,"chars. minifying...");
            }

            if (preloaded && filename.endsWith(".min.js")) {
                delete result.min;
            } else {
                js_source = minifyJS(js_source);
                fs.writeFileSync(min_filename,js_source);
                if(!process.mainModule) {
                    console.log("wrote:",min_filename);
                    console.log("final minifed source:",js_source.length,"chars");
                }
            }

            return isList ? result : undefined;

        }

    function makePackage(name,pkg_fn){

        var pkg_bare = pkg_fn.toString().trimEnd();

        var template = packageTemplate.toString().trimEnd();
        template = template.substring(template.indexOf('{')+1,template.length-1).trim().split('function acme_package(){}');
        template.push(template.pop().split('${acme}').join(name));

        return template.join(('function($N){'+pkg_bare.substring(pkg_bare.indexOf('{')+1)));
    }

    function makeMultiPackage(mods){


        var template = multiPackageTemplate.toString().trimEnd();
        template = template.substring(template.indexOf('{')+1,template.length-1).trim().split('$N[0][$N[1]]=(function acme_package(){})(!$N[0].Document);');
        template.push(

            template.pop().split('"${acme}"').join(

                mods.map(

                    function(el){return JSON.stringify(el.name);}

                    ).join(",")

            )
        );


        return template.join(mods.map(function(el,ix){

            var pkg_bare = el.js.toString().trimEnd();
            var skip = ix===0?'\n':'';
            return skip+'/* '+el.name+' (source in '+path.basename(el.file) +') */\n'+
            '$N[0][$N['+String(1+ix)+']]=(function($N){'+pkg_bare.substring(pkg_bare.indexOf('{')+1)+')(!$N[0].Document);\n';

        }).join (''));

    }

    function makeMultiPackage2(mods){


        var template = multiPackageTemplate2.toString().trimEnd();
        template = template.substring(template.indexOf('{')+1,template.length-1).trim().split('$N["${acme}"]=(function acme_package(){})(!$N.Document);');
       /* template.push(

            template.pop().split('"${acme}"').join(

                mods.map(

                    function(el){return JSON.stringify(el.name);}

                    ).join(",")

            )
        );*/


        return template.join(mods.map(function(el,ix){

            var pkg_bare = el.js.toString().trimEnd();
            var skip = ix===0?'\n':'';
            return skip+'/* '+el.name+' (source in '+path.basename(el.file) +') */\n'+
            '$N['+JSON.stringify(el.name)+']=(function($N){'+pkg_bare.substring(pkg_bare.indexOf('{')+1)+')(!$N.Document);\n';
//            '$N[0][$N['+String(1+ix)+']]=(function($N){'+pkg_bare.substring(pkg_bare.indexOf('{')+1)+')(!!$N[0].id);\n';

        }).join (''));

    }

    function def_mod_name(filename) {
        return require("path").basename(filename).split('.')[0].split('-').join('');
    }

    function mod_list(x) {
        /*

         modlist('somefile.js') ----> [ {js:'somefile.js', mod:'somefile'} ]
         ['somefile1.js', 'somefile2.js' ] ----> [ {js:'somefile1.js', mod:'somefile1'},{js:'somefile2.js', mod:'somefile2'} ]

         {
            custom1     : 'somefile1.js',
            otherThing : 'somefile2.js',

         } ----> [ {js:'somefile1.js', mod:'custom1'},{js:'somefile2.js', mod:'otherThing'} ]

        */

         switch(typeof x) {
            case "string" : return [{mod:def_mod_name(x), js : x}];
            case "object" :
                if (x.constructor===Array) {
                    var res = [];
                    x.forEach(function(el){
                        if (x.mod && x.js) {
                           return res.push(x);
                        }
                        var mods = mod_list(el);
                        if (mods.length>0) {
                            res.push.apply(res,mods);
                        }
                    });
                    return res;
                }

                if (x.mod && x.js) return [x];

                return Object.keys(x).map(function(nm){
                      return {mod:nm, js : x[nm]};
                });
            default: return [];
        }

    }

    function buildMulti(x,filename) {

        var pkg_filename = filename.replace(/\.js$/,'.pkg.js') ;
        var min_filename = filename.replace(/\.js$/,'.min.js') ;

        var list  = mod_list(x);
        var built = list.map(build);
        var multi_source = makeMultiPackage(built);
        fs.writeFileSync(pkg_filename,multi_source);

        multi_source = minifyJS(multi_source);
        fs.writeFileSync(min_filename,multi_source);

    }

    function buildNamed(x,filename) {

        var pkg_filename = filename.replace(/\.js$/,'.pkg.js') ;
        var min_filename = filename.replace(/\.js$/,'.min.js') ;

        var list  = mod_list(x);
        var built = list.map(build);
        var multi_source = makeMultiPackage2(built);
        fs.writeFileSync(pkg_filename,multi_source);

        multi_source = minifyJS(multi_source);
        fs.writeFileSync(min_filename,multi_source);

    }


    return {
        build           : build,
        buildMulti      : buildMulti,
        buildNamed      : buildNamed
    };
})(!$N[0].Document);})(typeof process+typeof module+typeof require==='objectobjectfunction'?[module,"exports"]:[window,"simplePackageWrap"]);