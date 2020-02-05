var $N=true;

module.exports = function ()
{

    if (!$N) throw new Error("you need node.js to use this file");

    var

    path           = require("path"),
    fs             = require("fs"),
    UglifyJS       = require("uglify-js"),
    babel          = require("babel-core"),
    extract_fn     = function(fn,data){
        fn = fn.toString();
        fn = fn.substring(fn.indexOf('{')+1,fn.lastIndexOf('}')).trim();
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

    function createZipLoader(filename,eventName,jsZipSrc,extraModules) {
        /*
            takes a zip file (filename)
            creates 2 files:
                filename.jszip
                filename.zip-loader.js

                when loaded in a browser, filename.zip-loader.js will load filename.jszip along with bundled JSZip
                JSZip will be installed into window.JSZip

                the zipfile will be opened and delivered as a zip object via dispatchEvent as a customEvent with the name eventName

                note: filename.jszip is effectively the contents of the zip file, prefixed with
                    - a small javascript function with a loader function
                    - the minified JSZip source
                    the small javascript function contains information detailing the position within the file of
                    both the JSZip library (uncompressed but minified,)

            */
        var
        fs  =require("fs"),
        path=require("path"),
        JSZipPackageFile=require.resolve("jszip"),
        JSZipPackagePath=path.dirname(JSZipPackageFile),
        JSZipMinifiedPath=jsZipSrc || path.join(JSZipPackagePath,"..","dist","jszip.min.js"),

        jszip_filename = filename.replace(/\.zip$/,'.jszip'),
        zip_loader_fn = filename.replace(/\.zip$/,'.zip-loader.js'),
        zip_tester_fn = filename.replace(/\.zip$/,'.zip-tester.js'),
        JSZipSourceBuffer = fs.readFileSync(JSZipMinifiedPath);

        if (extraModules) JSZipSourceBuffer =
            Buffer.concat([JSZipSourceBuffer,Buffer.from(extraModules)]);

        var
        loader = JSZipBootloader(JSZipSourceBuffer,fs.readFileSync(filename));

        fs.writeFileSync(jszip_filename,loader.buffer);
        fs.writeFileSync(zip_loader_fn,loader.script);
        fs.writeFileSync(zip_tester_fn,loader.nodeTester);


        function JSZipBootloader(JSZipBuffer,ZipFileBuffer) {

            var JSZipOffsetStart,JSZipOffsetEnd,ZipFileOffsetStart,ZipFileOffsetEnd;

            function loader(func,str,arr,exp,cb) {
                var getJSZip=function(){return func([],str(JSZipOffsetStart,JSZipOffsetEnd))();};
                try {
                    getJSZip();
                    var zip = new exp.JSZip();
                    zip.loadAsync(arr(ZipFileOffsetStart,ZipFileOffsetEnd))
                      .then(function(zip){cb(null,zip);})
                      .catch(cb);
                } catch(err) {
                    cb(err);
                }
            }

            function loadJSZip (url,cb) {

                try {

                    var xhr=new window.XMLHttpRequest();

                    xhr.open('GET', url, true);

                    if ("responseType" in xhr) {
                        xhr.responseType = "arraybuffer";
                        xhr.ab = function(){return xhr.response};
                    } else {
                        xhr.ab  = function () {
                            var s=xhr.responseText,ab=new ArrayBuffer(s.length*2);
                            var vw = new Uint16Array(ab);
                            for (var i=0, l=s.length; i<l; i++) {
                               vw[i] = s.charCodeAt(i);
                            }
                            return ab;
                        };
                    }

                    if(xhr.overrideMimeType) {
                        xhr.overrideMimeType("text/plain; charset=x-user-defined");
                    }

                    xhr.onreadystatechange = function (event) {
                        if (xhr.readyState === 4) {
                            if (xhr.status === 200 || xhr.status === 0) {
                                try {
                                    bootload(xhr.ab(),window,cb);
                                } catch(err) {
                                    cb(new Error(err));
                                }
                            } else {
                                cb(new Error("Ajax error for " + url + " : " + this.status + " " + this.statusText));
                            }
                        }
                    };

                    xhr.send();

                } catch (e) {
                    cb(new Error(e), null);
                }



            }

            function bootload(ab,exp,cb) {
                var
                F=Function,
                arr=ab.slice.bind(ab),
                str=function(a,b){return String.fromCharCode.apply(null,new Uint8Array(ab.slice(a,b)));},
                len=230,

                re=new RegExp('^.*(?=\\/\\*)','s'),
                //re=/\[[0-9|\s]{7},[0-9|\s]{7},[0-9|\s]{7}\]/,
                m,newCall = function (Cls) {
                   /*jshint -W058*/
                   return new (F.prototype.bind.apply(Cls, arguments));
                   /*jshint +W058*/
                },func = function (args,code){
                   return newCall.apply(this,[F].concat(args,[code]));
                };

                while (!(m=re.exec(str(0,len)))) {len += 10;}

                return func(['func','str','arr','exp','cb'],m[0]) (func,str,arr,exp,cb);
            }

            function setVar(name,value,src) {
                    return src.split(name).join(""+value);
            }

            function setValues(obj,src) {
                Object.keys(obj).forEach(function(k){
                    src=setVar(k,obj[k],src);
                });
                return src;
            }

            var
                loadJSZip_src =
                minifyJS(bootload.toString())+"\n"+
                minifyJS(loadJSZip.toString())+"\n",

            browserSuffixFn = function(){

                loadJSZip( "${filename}", function(err,zip){
                    if(err){
                        return;
                    }

                        window.start_fs(zip,function(err,fs){

                            if(err){
                                return;
                            }


                            window.dispatchEvent(new CustomEvent("${eventName}",
                            {
                                detail:{zip:zip,fs:fs}

                            }));

                        });

                    } );
            },

            browserSuffix=extract_fn(browserSuffixFn,{
                filename:path.basename(jszip_filename),
                eventName:eventName
            }),

            src_fixed_temp,src_fixed,
            template  = loader.toString(),
            setVars=function() {
                JSZipOffsetStart   = src_fixed.length;
                JSZipOffsetEnd     = JSZipOffsetStart+JSZipBuffer.length;
                ZipFileOffsetStart = JSZipOffsetEnd;
                ZipFileOffsetEnd   = ZipFileOffsetStart+ZipFileBuffer.length;
                src_fixed_temp = minifyJS(
                    setValues({
                    JSZipOffsetStart   : JSZipOffsetStart,
                    JSZipOffsetEnd     : JSZipOffsetEnd,
                    ZipFileOffsetStart : ZipFileOffsetStart,
                    ZipFileOffsetEnd   : ZipFileOffsetEnd
                },template));
            };

            src_fixed = template = extract_fn(template)+"\n";

            setVars();

            while (src_fixed.length !==src_fixed_temp.length) {
                src_fixed = src_fixed_temp;
                setVars();
            }

            function nodeTester () {


                            var
                            fs = require("fs"),
                            path = require("path"),
                            express=require("express"),
                            app = express(),
                            filename = path.resolve("${filename}"),
                            jszip_filename = filename.replace(/\.zip$/,'.jszip'),
                            zip_loader_fn = filename.replace(/\.zip$/,'.zip-loader.js'),
                            zip_html_fn = filename.replace(/\.zip$/,'.zip-tester.html'),
                            //chromebooks do something funky with localhost under penguin/crostini, so help a coder out....
                            hostname = isChromebook() ? "penguin.termina.linux.test" : "localhost",
                            child_process           = require("child_process");

                            function isChromebook() {
                                var os = require("os");
                                if (os.hostname()==="penguin" && os.platform()==="linux") {
                                    var run=require("child_process").execSync;
                                    try {
                                        var cmd = run ("which systemd-detect-virt").toString().trim();
                                        return (run(cmd).toString().trim()==="lxc");
                                    } catch (e) {

                                    }
                                }
                                return false;
                            }

                            var html = [
                                       "<html>",
                                       "<head></head>",
                                       "<body>",
                                       '<div id="info">loading...</div>',
                                       '<script src="/'+path.basename(zip_loader_fn)+'"></script>',
                                       '<script>window.addEventListener("'+eventName+'",function(e){ document.getElementById("info").innerHTML="done"; console.log(e); });</script>',
                                       "</body>",
                                       "</html>",
                                       ].join("\n");

                            fs.writeFileSync(zip_html_fn,html);

                            app.use("/"+path.basename(jszip_filename), express.static(jszip_filename));
                            app.use("/"+path.basename(zip_loader_fn), express.static(zip_loader_fn));
                            app.get("/", function(req,res){
                                res.send(html);
                            });


                            var listener = app.listen(3000, function() {
                               var url =  'http://'+hostname+':' + listener.address().port + "/";
                               console.log('goto '+url);
                               child_process.spawn("xdg-open",[url]);
                           });


                        }

            return {
                script     : loadJSZip_src+browserSuffix,
                nodeTester : extract_fn(nodeTester).split("${filename}").join(jszip_filename),
                buffer : Buffer.concat([Buffer.from(src_fixed_temp),JSZipBuffer,ZipFileBuffer])
            };

        }

    }

    function createPakoLoader(filename,eventName,jsZipSrc,extraModules) {
        /*
            takes a zip file (filename)
            creates 2 files:
                filename.jszip
                filename.zip-loader.js

                when loaded in a browser, filename.zip-loader.js will load filename.jszip along with bundled JSZip
                JSZip will be installed into window.JSZip

                the zipfile will be opened and delivered as a zip object via dispatchEvent as a customEvent with the name eventName

                note: filename.jszip is effectively the contents of the zip file, prefixed with
                    - a small javascript function with a loader function
                    - the minified JSZip source
                    the small javascript function contains information detailing the position within the file of
                    both the JSZip library (uncompressed but minified,)

            */
        var
        fs  =require("fs"),
        path=require("path"),
        JSZipPackageFile=require.resolve("jszip"),
        JSZipPackagePath=path.dirname(JSZipPackageFile),
        JSZipMinifiedPath= jsZipSrc || path.join(JSZipPackagePath,"..","dist","jszip.min.js"),
        zlib = require('zlib'),
        PakoPackageFile=require.resolve("pako"),
        PakoPackagePath=path.dirname(PakoPackageFile),
        PakoMinifiedPath=path.join(PakoPackagePath,"dist","pako_inflate.min.js"),

        jszip_filename = filename.replace(/\.zip$/,'.jszip'),
        pako_loader_fn = filename.replace(/\.zip$/,'.pako-loader.js'),
        pako_tester_fn = filename.replace(/\.zip$/,'.pako-tester.js'),

        JSZipUncompressedBuffer = fs.readFileSync(JSZipMinifiedPath);

        if (extraModules) JSZipUncompressedBuffer =
            Buffer.concat([JSZipUncompressedBuffer,Buffer.from(extraModules)]);


        var
        loader = JSZipBootloader(
            fs.readFileSync(PakoMinifiedPath),
            zlib.deflateSync(JSZipUncompressedBuffer),
            fs.readFileSync(filename));


        fs.writeFileSync(jszip_filename,loader.buffer);
        fs.writeFileSync(pako_loader_fn,loader.script);
        fs.writeFileSync(pako_tester_fn,loader.nodeTester);

        function JSZipBootloader(PakoBuffer,JSZipBuffer,ZipFileBuffer) {

            var
            pakoOffsetStart,pakoOffsetEnd,
            JSZipOffsetStart,JSZipOffsetEnd,
            ZipFileOffsetStart,ZipFileOffsetEnd;

            function loader(func,str,arr,exp,cb) {
                var
                p=function(){return func([],str(pakoOffsetStart,pakoOffsetEnd))();},
                z=function(){return func([],exp.pako.inflate(arr(JSZipOffsetStart,JSZipOffsetEnd),{to:'string'}))();};
                try {
                    p();
                    z();
                    var zip = new exp.JSZip();
                    zip.loadAsync(arr(ZipFileOffsetStart,ZipFileOffsetEnd))
                      .then(function(zip){cb(null,zip);})
                      .catch(cb);
                } catch(err) {
                    cb(err);
                }
                p=z=null;
            }

            function loadJSZip (url,cb) {

                try {

                    var xhr=new window.XMLHttpRequest();

                    xhr.open('GET', url, true);

                    if ("responseType" in xhr) {
                        xhr.responseType = "arraybuffer";
                        xhr.ab = function(){return xhr.response};
                    } else {
                        xhr.ab  = function () {
                            var s=xhr.responseText,ab=new ArrayBuffer(s.length*2);
                            var vw = new Uint16Array(ab);
                            for (var i=0, l=s.length; i<l; i++) {
                               vw[i] = s.charCodeAt(i);
                            }
                            return ab;
                        };
                    }

                    if(xhr.overrideMimeType) {
                        xhr.overrideMimeType("text/plain; charset=x-user-defined");
                    }

                    xhr.onreadystatechange = function (event) {
                        if (xhr.readyState === 4) {
                            if (xhr.status === 200 || xhr.status === 0) {
                                try {
                                    bootload(xhr.ab(),window,cb);
                                } catch(err) {
                                    cb(new Error(err));
                                }
                            } else {
                                cb(new Error("Ajax error for " + url + " : " + this.status + " " + this.statusText));
                            }
                        }
                    };

                    xhr.send();

                } catch (e) {
                    cb(new Error(e), null);
                }



            }

            function bootload(ab,exp,cb) {
                var
                F=Function,
                arr=ab.slice.bind(ab),
                str=function(a,b){return String.fromCharCode.apply(null,new Uint8Array(ab.slice(a,b)));},
                len=230,

                re=new RegExp('^.*(?<=(p\\w*=\\w*z=\\w*null\\w*;))','s'),
                //re=/\[[0-9|\s]{7},[0-9|\s]{7},[0-9|\s]{7}\]/,
                m,newCall = function (Cls) {
                   /*jshint -W058*/
                   return new (F.prototype.bind.apply(Cls, arguments));
                   /*jshint +W058*/
                },func = function (args,code){
                   return newCall.apply(this,[F].concat(args,[code]));
                };

                while (!(m=re.exec(str(0,len)))) {len += 10;}

                return func(['func','str','arr','exp','cb'],m[0]) (func,str,arr,exp,cb);
            }

            function setVar(name,value,src) {
                    return src.split(name).join(""+value);
            }

            function setValues(obj,src) {
                Object.keys(obj).forEach(function(k){
                    src=setVar(k,obj[k],src);
                });
                return src;
            }



            var
                loadJSZip_src =
                minifyJS(bootload.toString())+"\n"+
                minifyJS(loadJSZip.toString())+"\n",

            browserSuffixFn = function(){

                loadJSZip( "${filename}", function(err,zip){
                    if(err){
                        return;
                    }

                        window.start_fs(zip,function(err,fs){

                            if(err){
                                return;
                            }


                            window.dispatchEvent(new CustomEvent("${eventName}",
                            {
                                detail:{zip:zip,fs:fs}

                            }));

                        });

                    } );
            },

            browserSuffix=extract_fn(browserSuffixFn,{
                filename:path.basename(jszip_filename),
                eventName:eventName
            }),

            src_fixed_temp,src_fixed,
            template  = loader.toString(),
            setVars=function() {
                pakoOffsetStart = src_fixed.length;
                pakoOffsetEnd   = pakoOffsetStart + PakoBuffer.length;

                JSZipOffsetStart   = pakoOffsetEnd;
                JSZipOffsetEnd     = JSZipOffsetStart+JSZipBuffer.length;

                ZipFileOffsetStart = JSZipOffsetEnd;
                ZipFileOffsetEnd   = ZipFileOffsetStart+ZipFileBuffer.length;

                src_fixed_temp = minifyJS(
                    setValues({
                    pakoOffsetStart    : pakoOffsetStart,
                    pakoOffsetEnd      : pakoOffsetEnd,
                    JSZipOffsetStart   : JSZipOffsetStart,
                    JSZipOffsetEnd     : JSZipOffsetEnd,
                    ZipFileOffsetStart : ZipFileOffsetStart,
                    ZipFileOffsetEnd   : ZipFileOffsetEnd
                },template))+'/**/';

            };

            src_fixed = template = extract_fn(template)+"\n";

            setVars();

            while (src_fixed.length !==src_fixed_temp.length) {
                src_fixed = src_fixed_temp;
                setVars();
            }

            function nodeTester () {


                var
                fs = require("fs"),
                path = require("path"),
                express=require("express"),
                app = express(),
                filename = path.resolve("${filename}"),
                jszip_filename = filename.replace(/\.zip$/,'.jszip'),
                pako_loader_fn = filename.replace(/\.zip$/,'.pako-loader.js'),
                pako_html_fn = filename.replace(/\.zip$/,'.pako-tester.html'),
                //chromebooks do something funky with localhost under penguin/crostini, so help a coder out....
                hostname = isChromebook() ? "penguin.termina.linux.test" : "localhost",
                child_process           = require("child_process");

                function isChromebook() {
                    var os = require("os");
                    if (os.hostname()==="penguin" && os.platform()==="linux") {
                        var run=require("child_process").execSync;
                        try {
                            var cmd = run ("which systemd-detect-virt").toString().trim();
                            return (run(cmd).toString().trim()==="lxc");
                        } catch (e) {

                        }
                    }
                    return false;
                }

                var html = [
                           "<html>",
                           "<head></head>",
                           "<body>",
                           '<div id="info">loading...</div>',
                           '<script src="/'+path.basename(pako_loader_fn)+'"></script>',
                           '<script>window.addEventListener("'+eventName+'",function(e){ document.getElementById("info").innerHTML="done"; console.log(e); });</script>',
                           "</body>",
                           "</html>",
                           ].join("\n");

                fs.writeFileSync(pako_html_fn,html);

                app.get("/", function(req,res){
                    res.send(html);
                });
                app.use("/"+path.basename(jszip_filename), express.static(jszip_filename));
                app.use("/"+path.basename(pako_loader_fn), express.static(pako_loader_fn));


                var listener = app.listen(3000, function() {
                    var url =  'http://'+hostname+':' + listener.address().port + "/";
                    console.log('goto '+url);
                    child_process.spawn("xdg-open",[url]);
                });



            }

            return {
                script     : loadJSZip_src+browserSuffix,
                nodeTester : extract_fn(nodeTester).split("${filename}").join(filename),
                buffer : Buffer.concat([Buffer.from(src_fixed_temp),PakoBuffer,JSZipBuffer,ZipFileBuffer])
            };

        }
    }

    return {
        build            : build,
        buildMulti       : buildMulti,
        buildNamed       : buildNamed,
        serveMulti       : serveMulti,
        serveNamed       : serveNamed,
        minifyJS         : minifyJS,
        createZipLoader  : createZipLoader,
        createPakoLoader : createPakoLoader
    };

};

var mod;

if(!process.mainModule) {

    mod                     = module.exports();
    global.build            = mod.build;
    global.buildMulti       = mod.buildMulti;
    global.buildNamed       = mod.buildNamed;
    global.serveNamed       = mod.serveNamed;
    global.serveMulti       = mod.serveMulti;
    global.createZipLoader  = mod.createZipLoader;
    global.createPakoLoader = mod.createPakoLoader;

} else {

    if (process.mainModule===module && process.argv.indexOf("--test")>0) {

        mod = module.exports();
         require("fs").unlink("./buildNamedTest.pkg.zip",function(err){
            if (!err) {
                console.log("removed:","./buildNamedTest.pkg.zip");
            }
            mod.buildNamed({simplePack:"./index.js","sample":"./sample.js"},"buildNamedTest",function(err,list,preBuilt,built){
                mod.buildNamed({"sample2":"./sample2.js"},"buildNamedTest",function(err,list,preBuilt,built){
                    require("fs").unlink("./buildMultiTest.pkg.zip",function(err){
                        if (!err) {
                            console.log("removed:","./buildMultiTest.pkg.zip");
                        }
                        mod.buildMulti({simplePack:"./index.js","sample":"./sample.js"},"buildMultiTest",function(err,list,preBuilt,built){
                            mod.buildMulti({"sample2":"./sample2.js"},"buildMultiTest",function(err,list,preBuilt,built){

                            });
                        });
                    });
                });
            });
        });
    }

    if (process.mainModule===module && process.argv.indexOf("--ziptest")>0) {

        mod = module.exports();
        mod.createZipLoader("./test.zip","zipLoaded");

    }

    if (process.mainModule===module && process.argv.indexOf("--pakotest")>0) {

        mod = module.exports();
        mod.createPakoLoader("./test.zip","zipLoaded");

    }

}
