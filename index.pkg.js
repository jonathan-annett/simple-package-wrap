(function($N){

/*./index.js*/
$N[0][$N[1]]=(function($N){
if (!$N) throw new Error("you need node.js to use this file");

    var

    path           = require("path"),
    fs             = require("fs"),
    UglifyJS       = require("uglify-js"),
    babel          = require("babel-core"),
    extract_fn     = function(fn){ fn = fn.toString(); return fn.substring(fn.indexOf('{')+1,fn.lastIndexOf('}')).trim()},
    minifyJS       = function minifyJS( js_src ) {

       var

       result1,
       result2;
       try {
           result1 = UglifyJS.minify(js_src, {
               parse: {},
               compress: {},
               mangle: false,
               comments:false,
               output: {
                   code: true
               }
           });
       } catch (e) {
            console.log(e.message);
            console.log("uglify failed. trying babel")
       }

       try {
           result2 = babel.transform(js_src,{minified:true,comments:false});
       } catch (e) {
            console.log(e.message);
            console.log("babel failed. "+(result1 && result1.code? "will use uglify output" : "will use uncompressed output"))
       }

       if (!result1 || !result1.code) return result2 ? result2.code :js_src;

       if (!result2 || !result2.code) return result1.code;

       return  (result1.code.length < result2.code.length) ? result1.code : result2.code;
    };

    function isPreloaded(fn) {
        switch (typeof fn) {
            case 'string' :
                fn = fn.trim();
                return ! (fn.startsWith('function')&&fn.endsWith('}'));

            case 'object' : return true;
            case 'function':
                if (fn.name!=='' || Object.keys(fn).length>0|| fn.length>0) return true;
        }
        return false;
    }

    function installEmbed(fn,ix,comment){
        var src =
        "\n/*"+comment+"*/\n"+
        "$N[0][$N["+String(ix+1)+"]]=(function($N){\n"+
        (typeof fn==='function'?extract_fn(fn):fn)+"\n"+
        "})(!$N[0].Document);\n";
        return src;
    }

    function preloadedExploder(fn) {
        return "(function($N,$E){$N[$E]={};(function(module,exports,window){\n"+
               "/* jshint ignore:start */\n"+
               fn.toString()+"\n"+
               "/* jshint ignore:end */\n"+
               "})($N,$N[$E],$N[$E]);return $N[$E];})({},'exports');\n";
    }

    function preloadedEmbed(fn,ix,comment){
        return "\n/*"+comment+"*/\n"+
        "$N[0][$N["+String(ix+1)+"]]="+preloadedExploder(fn);
    }

    function installNamedEmbed(fn,name,comment){
        var src =
        "\n/*"+comment+"*/\n"+
        "$N['"+name+"']=(function($N){\n"+
            (typeof fn==='function'?extract_fn(fn):fn)+"\n"+
        "})(!$N.Document);\n";
        return src;
    }

    function preloadedNamedEmbed(fn,name,comment){
        return "\n/*"+comment+"*/\n"+
        "$N['"+name+"']="+preloadedExploder(fn);
    }


    function makePackage(name,fn,listIndex,comment){
        var source = isPreloaded(fn) ? preloadedEmbed(fn,listIndex,comment) : installEmbed(fn,listIndex,comment);
        return "(function($N){\n"+
        source+"\n"+
        "})(typeof process+typeof module+typeof require==='objectobjectfunction'?[module,'exports']:[window,'"+name+"']);\n";
    }

    function build (filename,moduleName) {

            var pkg_filename;
            var min_filename;

            var isList = typeof filename === 'object' && typeof filename.mod==='string' && filename.js,
                listIndex=0,list;

            if (isList) {
                listIndex    = arguments[1];
                if (typeof filename.index === 'number') {
                    listIndex= filename.index;
                }
                list         = arguments[2];
                moduleName   = filename.mod;
                pkg_filename = filename.pkg;
                min_filename = filename.min;
                filename     = filename.js;

            } else {
                moduleName  = typeof moduleName==='string' ? moduleName : def_mod_name(filename);
            }

            if (!filename) {
                if(!process.mainModule) {
                    return console.log("usage: build(filename,moduleName)");
                }
                throw new Error ("incorrect arguments passed to build");
            }


            var js_source;

            try {
                js_source=require(filename);
            } catch (e) {

            }
            if (typeof js_source!=='function') {
                js_source = fs.readFileSync(filename,"utf8").trim();
            } else {
                if (isPreloaded(js_source)) {
                    js_source =
                            '/*pre-packaged '+path.basename(filename)+' begin*/\n'+
                            fs.readFileSync(filename,"utf8").trim();
                            '\n/*pre-packaged '+path.basename(filename)+' end*/\n';

                }
            }

            pkg_filename = pkg_filename || filename.replace(/\.js$/,'.pkg.js') ;
            min_filename = min_filename || filename.replace(/\.js$/,'.min.js') ;

            var result = {
                js   : js_source,
                mod  : moduleName,
                file : filename,
                pkg  : { file : pkg_filename},
                min  : { file : min_filename},
            };

            js_source = makePackage(moduleName,js_source,listIndex,filename);
            fs.writeFileSync(pkg_filename ,js_source);
            if(!process.mainModule) {
                console.log("wrote:",pkg_filename);
                console.log("packaged source:",js_source.length,"chars. minifying...");
            }

            if (filename.endsWith(".min.js")) {
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

    function makeMultiPackage(mods){

        return '(function($N){\n'+

            mods.map(function(el,listIndex) {
                delete el.index;
                var handler = (isPreloaded(el.js) ? preloadedEmbed : installEmbed);
                return handler(el.js,listIndex,path.basename(el.file));
            }).join('\n') +
        '})([typeof process+typeof module+typeof require==="objectobjectfunction"?module.exports:window,'+

           mods.map(function(el){return JSON.stringify(el.mod)}).join(',')+

        ']);';

    }

    function makeNamedPackage(mods){


        return '(function($N){\n'+

            mods.map(function(el) {
                delete el.index;
                var handler = (isPreloaded(el.js) ? preloadedNamedEmbed : installNamedEmbed);
                return  handler (el.js,el.mod,path.basename(el.file));
            }).join('\n') +

        '})(typeof process+typeof module+typeof require==="objectobjectfunction"?module.exports:window);';


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
                            x.index=0;
                            return res.push(x);
                        }
                        var mods = mod_list(el);
                        if (mods.length>0) {
                            res.push.apply(res,mods);
                        }
                    });
                    return res;
                }

                if (x.mod && x.js) {
                    x.index=0;
                    return [x];
                }

                return Object.keys(x).map(function(nm){
                      return {mod:nm, js : x[nm], index:0};
                });
            default: return [];
        }

    }

    function buildMulti(x,filename) {
        if (!filename.endsWith(".js")) filename+=".js";

        var pkg_filename = filename.replace(/\.js$/,'.pkg.js') ;
        var min_filename = filename.replace(/\.js$/,'.min.js') ;

        var list  = mod_list(x);
        var built = list.map(build);
        var multi_source = makeMultiPackage(built);
        fs.writeFileSync(pkg_filename,multi_source);

        multi_source = minifyJS(multi_source);
        fs.writeFileSync(min_filename,multi_source);

    }

    function buildNamed(x,filename,extendAndCB) {

        if (!filename.endsWith(".js")) filename+=".js";
        var pkg_filename = filename.replace(/\.js$/,'.pkg.js') ;
        var min_filename = filename.replace(/\.js$/,'.min.js') ;
        var json_filename= filename.replace(/\.js$/,'.pkg.json') ;
        var zip_filename= filename.replace(/\.js$/,'.pkg.zip') ;

        var list  = mod_list(x);

        if (typeof extendAndCB==='function') {
            fs.readFile(zip_filename, function(err, data) {
                if (err) return doBuild();
                JSZip.loadAsync(data).then(function (zip) {
                    zip.file(path.basename(json_filename)).then(function(json){
                        // get previously built mods
                        var info = JSON.parse(json);
                        // remove any modules in the new list from the previous list
                        // (we are updating them, so we can dimp the old version)
                        list.forEach(function(mod){
                            delete info.dir[mod];
                        });
                        // now convert the index format back to an array in the "built" format
                        var prevBuilt = Object.keys(info.dir).map(function(mod){return info.dir[mod]});

                        // an if there are any modules there, pass them into the build function
                        doBuild(list,prevBuilt.length===0?undefined:prevBuilt);
                    }).catch(extendAndCB);;
                });
            });
        } else {
            return doBuild();
        }


        function doBuild(list,preBuilt) {

            var built = list.map(build);

            if (preBuilt && preBuilt.length>0) {
                // prepend the previously built modules to the list
                built = preBuilt.concat(built);
            }

            var multi_source = makeNamedPackage(built);
            fs.writeFileSync(pkg_filename,multi_source);

            multi_source = minifyJS(multi_source);
            fs.writeFileSync(min_filename,multi_source);

            var json = {dir:{}};
            built.forEach(function(el){
                json.dir[el.mod]=JSON.parse(JSON.stringify(el));
            });

            json=JSON.stringify(json,undefined,4);
            fs.writeFileSync(json_filename,json);

            var JSZip = require("jszip");
            var zip = new JSZip();
            zip.file(path.basename(json_filename),json);

           zip
           .generateNodeStream({
               type:'nodebuffer',
               streamFiles:true,
                compression: "DEFLATE",
                compressionOptions: {
                    level: 9
                }
           })
           .pipe(fs.createWriteStream(zip_filename))
           .on('finish', function () {
               // JSZip generates a readable stream with a "end" event,
               // but is piped here in a writable stream which emits a "finish" event.
               console.log((preBuilt ? "updated" : "saved"),zip_filename, "(with",json_filename,"inside)");
           });

        }

    }


    return {
        build           : build,
        buildMulti      : buildMulti,
        buildNamed      : buildNamed
    };
})(!$N[0].Document);

})(typeof process+typeof module+typeof require==='objectobjectfunction'?[module,'exports']:[window,'simplePackageWrap']);
