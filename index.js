

    Object.defineProperties(module.exports,{
        build : {
            value : function (filename,moduleName) {

                var path = require("path"),
                fs =require("fs"),
                UglifyJS     = require("uglify-js"),
                babel = require("babel-core"),
                minifyJS = function minifyJS( js_src ) {
                   var result1= UglifyJS.minify(js_src, {
                       parse: {},
                       compress: {},
                       mangle: false,
                       output: {
                           code: true
                       }
                   });

                   var result2 = babel.transform(js_src,{minified:true});


                   if (!result1.code) return result2.code;

                   return  (result1.code.length < result2.code.length) ? result1.code : result2.code;
                };


                var js_zipWrap_js = fs.readFileSync(filename,"utf8");
                js_zipWrap_js = makePackage(moduleName,js_zipWrap_js);
                fs.writeFileSync(filename.replace(/\.js$/,'.pkg.js') ,js_zipWrap_js);
                js_zipWrap_js = minifyJS(js_zipWrap_js);
                fs.writeFileSync(filename.replace(/\.js$/,'.min.js'),js_zipWrap_js);

                function makePackage(name,pkg_fn){

                    var pkg_bare = pkg_fn.toString().trimEnd();

                    var template = packageTemplate.toString().trimEnd();
                    template = template.substring(template.indexOf('{')+1,template.length-1).trim().split('function acme_package(){}');
                    template.push(template.pop().split('${acme}').join(name));

                    return template.join(('function()'+pkg_bare.substring(pkg_bare.indexOf('{'))));
                }



            },
            configurable:false,
            enumerable:true
        }
    });


    if (process.mainModule === module && require("fs").existsSync(process.argv[2]) && process.argv[3]) {
        module.exports.build(process.argv[2],process.argv[3]);
    }


function packageTemplate(){(function(x){x[0][x[1]]=(function acme_package(){})();})(typeof process+typeof module+typeof require==='objectobjectfunction'?[module,"exports"]:[window,"${acme}"]);}
