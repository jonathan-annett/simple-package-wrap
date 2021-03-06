(function($N){

/*./index.js*/
$N[0][$N[1]]=(function($N){
if (!$N) throw new Error("you need node.js to use this file");

    var

    path           = require("path"),
    fs             = require("fs"),
    UglifyJS       = require("uglify-js"),
    babel          = require("babel-core"),
    extract_fn     = function extract_fn(fn,data,keep){
        fn = fn.toString();
        if (!keep) fn = fn.substring(fn.indexOf('{')+1,fn.lastIndexOf('}')).trim();
        if (data) {
            Object.keys(data).forEach(function(k){
                fn=fn.split('${'+k+'}').join(data[k]);
            });
        }
        return fn;
    },
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
            console.log("uglify failed. trying babel");
       }

       try {
           result2 = babel.transform(js_src,{minified:true,comments:false});
       } catch (e) {
            console.log(e.message);
            console.log("babel failed. "+(result1 && result1.code? "will use uglify output" : "will use uncompressed output"));
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
        nameify('$N',name)+"=(function($N){\n"+
            (typeof fn==='function' ? extract_fn(fn):fn)+"\n"+
        "})(!$N.Document);\n";
        return src;
    }

    function preloadedNamedEmbed(fn,name,comment){
        return "\n/*"+comment+"*/\n"+
        nameify('$N',name)+"="+preloadedExploder(fn);
    }

    function makePackage(name,fn,listIndex,comment){
        var source = isPreloaded(fn) ? preloadedEmbed(fn,listIndex,comment) : installEmbed(fn,listIndex,comment);
        return { fn : fn,
                 js : [ "(function($N){\n",
                   source,
                   "\n})(typeof process+typeof module+typeof require==='objectobjectfunction'?[module,'exports']:[window,'"+name+"']);\n"],
        };
    }

    function build (filename,moduleName) {

        var pkg_filename;
        var min_filename;

        var isList = typeof filename === 'object' && typeof filename.mod==='string' && filename.js,
            saveLocally=true,
            listIndex=0,
            list;

        if (isList) {
            listIndex    = arguments[1];
            if (typeof filename.index === 'number') {
                listIndex= filename.index;
            }
            list         = arguments[2];
            moduleName   = filename.mod;
            pkg_filename = filename.pkg;
            min_filename = filename.min;
            if (typeof filename.saveLocally === 'boolean') {
                saveLocally = filename.saveLocally;

            }
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
                        fs.readFileSync(filename,"utf8").trim()+'\n'+
                        '\n/*pre-packaged '+path.basename(filename)+' end*/\n';

            }
        }

        pkg_filename = pkg_filename || filename.replace(/\.js$/,'.pkg.js') ;
        min_filename = min_filename || filename.replace(/\.js$/,'.min.js') ;

        var result = {
            js   : js_source,
            mod  : moduleName,
            file : filename,
            min  : {file : min_filename},
        };

        result.pkg=makePackage(moduleName,js_source,listIndex,filename);
        result.pkg.file = pkg_filename;

        js_source = result.pkg.js.join('');
        if (saveLocally) fs.writeFileSync(pkg_filename ,js_source);
        if(!process.mainModule) {
            console.log("wrote:",pkg_filename);
            console.log("packaged source:",js_source.length,"chars. minifying...");
        }

        if (filename.endsWith(".min.js")) {
            delete result.min;
        } else {
            result.min.js = js_source = minifyJS(js_source);
            if (saveLocally) fs.writeFileSync(min_filename,js_source);
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
                var js = el.pkg && el.pkg.fn ? el.pkg.fn : false ;
                if (!js) {
                    js = el.js;
                }
                if (js) {
                    var handler = (isPreloaded(el.js) ? preloadedEmbed : installEmbed);
                    js = handler(el.js,listIndex,path.basename(el.file));
                }
                delete el.js;
                return  js;
            }).join('\n') +
        '})([typeof process+typeof module+typeof require==="objectobjectfunction"?module.exports:window,'+

           mods.map(function(el){return JSON.stringify(el.mod);}).join(',')+

        ']);';

    }

    function makeNamedPackage(mods){


        return '(function($N){\n'+

            mods.map(function(el) {
                delete el.index;
                var js = el.pkg && el.pkg.fn ? el.pkg.fn : false ;
                if (!js) {
                    js = el.js;
                }
                if (js) {
                    var handler = (isPreloaded(js) ? preloadedNamedEmbed : installNamedEmbed);
                    js = handler (js,el.mod,path.basename(el.file));
                }
                delete el.js;
                return  js;
            }).join('\n') +

        '})(typeof process+typeof module+typeof require==="objectobjectfunction"?module.exports:window);';


    }

    function nameify(inside,name) {
        if (name.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
            return inside+'.'+name;
        } else {
            return inside+'["'+name+'"]';
        }
    }

    function def_mod_name(filename) {
        return require("path").basename(filename).split('.')[0].split('-').join('');
    }

    function zip_store_name(reference,fn,subdir) {
        var dir = path.dirname(reference);
        subdir = subdir ? subdir+"/" : "";
        if (fn.startsWith(dir))  return subdir+fn.substr(dir.length+1);
        if (fn.startsWith("./")) return subdir+fn.substr(2);
        return subdir+fn;
    }

    function mod_list(x,saveLocally) {

         switch(typeof x) {
            case "string" : return [{mod:def_mod_name(x), js : x, index:0, saveLocally:saveLocally}];
            case "object" :
                if (x.constructor===Array) {
                    var res = [];
                    x.forEach(function(el){
                        if (x.mod && x.js) {
                            x.index=0;
                            x.saveLocally=saveLocally;
                            return res.push(x);
                        }
                        var mods = mod_list(el,saveLocally);
                        if (mods.length>0) {
                            res.push.apply(res,mods);
                        }
                    });
                    return res;
                }

                if (x.mod && x.js) {
                    x.index=0;
                    x.saveLocally=saveLocally;
                    return [x];
                }

                return Object.keys(x).map(function(nm){
                      return {
                          mod:nm,
                          js : x[nm],
                          index:0,
                          saveLocally:saveLocally
                      };

                });
            default: return [];
        }

    }

    function buildArray(x,filename,extendAndCB,packageFunc,saveLocally,saveZip) {

            if (!filename.endsWith(".js")) filename+=".js";
            var pkg_filename  = filename.replace(/(\.js)$/,'.pkg.js') ;
            var min_filename  = filename.replace(/(\.js)$/,'.min.js') ;
            var json_filename = filename.replace(/(\.js)$/,'.pkg.json') ;
            var zip_filename  = filename.replace(/(\.js)$/,'.pkg.zip') ;

            var list  = mod_list(x,saveLocally);
            var JSZip = require("jszip");


            if (typeof extendAndCB==='function') {
                fs.readFile(zip_filename, function(err, data) {
                    if (err) return doBuild(list);
                    new JSZip().loadAsync(data).then(function (zip) {
                        zip.file(path.basename(json_filename))
                        .async("nodebuffer")
                        .then(function(json){
                            // get previously built mods
                            var info = JSON.parse(json);
                            // remove any modules in the new list from the previous list
                            // (we are updating them, so we can dimp the old version)

                            //console.log({list,previous:info});

                            list.forEach(function(el){
                                if (info.dir[el.mod]) {
                                    console.log("will replace",el.mod,"in",zip_filename);
                                    delete info.dir[el.mod];
                                } else {
                                    console.log("will add",el.mod,"to",zip_filename);
                                }
                            });



                            // now convert the index format back to an array in the "built" format
                            var prevBuilt = Object.keys(info.dir).map(function(k){return info.dir[k];});


                            //console.log({list,prevBuilt});


                            // an if there are any modules there, pass them into the build function
                            doBuild(list,prevBuilt.length===0?undefined:prevBuilt);
                        }).catch(extendAndCB);
                    });
                });
            } else {
                return doBuild(list);
            }


            function doBuild(list,preBuilt) {

                var built = list.map(build);

                if (preBuilt && preBuilt.length>0) {
                    // prepend the previously built modules to the list
                    built = preBuilt.concat(built);
                }


                var zip = new JSZip();
                zip.file(path.basename(json_filename),'{}');


                var multi_source = packageFunc(built);
                fs.writeFileSync(pkg_filename,multi_source);
                zip.file(zip_store_name(filename,pkg_filename),multi_source);

                multi_source = minifyJS(multi_source);
                fs.writeFileSync(min_filename,multi_source);
                zip.file(zip_store_name(filename,min_filename),multi_source);

                var json = {dir:{}};
                built.forEach(function(el){
                    console.log("stored",el.mod,"in",zip_filename);
                    if (el.pkg && el.pkg.js) zip.file(zip_store_name(filename,el.pkg.file,"dependancies"),el.pkg.js.join(''));
                    if (el.min && el.min.js) zip.file(zip_store_name(filename,el.min.file,"dependancies"),el.min.js);
                    delete el.js;
                    json.dir[el.mod]=JSON.parse(JSON.stringify(el));
                });

                json=JSON.stringify(json,undefined,4);

                if (saveLocally) fs.writeFileSync(json_filename,json);

                zip.file(path.basename(json_filename),json);

               var saver = zip[saveZip?"generateNodeStream":"generateAsync"]({
                   type:'nodebuffer',
                   streamFiles:true,
                    compression: "DEFLATE",
                    compressionOptions: {
                        level: 9
                    }
               });

                if (saveZip) {
                   saver.pipe(fs.createWriteStream(zip_filename)).on('finish', onDone);
                } else {
                    saver.then (onDone);
                }

                function onDone(zipContent) {
                     // JSZip generates a readable stream with a "end" event,
                     // but is piped here in a writable stream which emits a "finish" event.
                     //console.log((preBuilt ? "updated" : "saved"),zip_filename, "(with",json_filename,"inside)");

                     if (extendAndCB) {
                         extendAndCB(null,list,preBuilt,built,zip,zipContent);
                     }
                 }

            }

        }

    function buildMulti(x,filename,extendAndCB) {
        return buildArray(x,filename,extendAndCB,makeMultiPackage,false,true);
    }

    function buildNamed(x,filename,extendAndCB) {
        return buildArray(x,filename,extendAndCB,makeNamedPackage,false,true);
    }

    function serveMulti(x,filename,url,express,app,cb) {

        return buildArray(x,filename,function(err,list,preBuilt,built,zip,zipContent){

            if (!err) {
                if(app && express && express.static)app.use(url,express.static(filename));
                cb(null,list,preBuilt,built,zip,zipContent);
            } else {
                cb(err);
            }

        },makeMultiPackage,false,true);

    }

    function serveNamed(x,filename,url,express,app,cb) {

        return buildArray(x,filename,function(err,list,preBuilt,built,zip,zipContent){

            if (!err) {
                if(app && express && express.static)app.use(url,express.static(filename));
                cb(null,list,preBuilt,built,zip,zipContent);
            } else {
                cb(err);
            }

        },makeNamedPackage,false,true);

    }


    return {
        build            : build,
        buildMulti       : buildMulti,
        buildNamed       : buildNamed,
        serveMulti       : serveMulti,
        serveNamed       : serveNamed,
        minifyJS         : minifyJS,
        extract_fn       : extract_fn
    };
})(!$N[0].Document);

})(typeof process+typeof module+typeof require==='objectobjectfunction'?[module,'exports']:[window,'simplePackageWrap']);
