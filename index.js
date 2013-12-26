var es         = require('event-stream'),
    gutil      = require('gulp-util'),
    Builder    = require('component-builder'),
    template   = require('fs').readFileSync(__dirname + '/template.js', 'utf-8'),
    templateRE = /{{(.+?)}}/g,
    assetTypes = ['scripts', 'styles', 'images', 'fonts', 'files']

function configure (builder, opt) {
    builder.copyAssetsTo(opt.out || 'build')
    if (opt.copy) {
        builder.copyFiles()
    }
    if (opt.dev) {
        builder.prefixUrls('./')
        builder.development()
        builder.addSourceURLs()
    }
    if (opt.prefix) {
        builder.prefixUrls(opt.prefix)
    }
    if (opt.use) {
        opt.use.forEach(function(plugin){
            builder.use(plugin)
        })
    }
    // custom configure function
    if (opt.configure) {
        opt.configure(builder)
    }
    if (opt.ignore) {
        opt.ignore.forEach(function (dep) {
            builder.ignore(dep)
        })
    }
    // ignore file types
    if (opt.only) {
        var only = Array.isArray(opt.only)
            ? opt.only
            : [opt.only]
        assetTypes.forEach(function (type) {
            if (only.indexOf(type) === -1) {
                ignoreType(builder, opt, type)
            }
        })
    }
}

function ignoreType (builder, opt, type) {
    delete builder.config[type]
    var deps = builder.config.dependencies,
        devDeps = builder.config.devDeps
    if (deps) {
        for (var key in deps) {
            builder.ignore(key, type)
        }
    }
    if (opt.dev && devDeps) {
        for (var key in devDeps) {
            builder.ignore(key, type)
        }
    }
}

function component (opt) {

    opt = opt || {}

    var stream = es.map(function (file, cb) {

        var builder = new Builder(file.base),
            filename = opt.name || 'build'

        configure(builder, opt)

        builder.build(function (err, obj) {

            if (err) return cb(err)

            var js = obj.js.trim(),
                css = obj.css.trim(),
                jsFile, cssFile

            if (builder.config.scripts && js) {
                if (opt.standalone) {
                    obj.configName = builder.config.name
                    obj.standaloneName = typeof opt.standalone === 'string'
                        ? opt.standalone
                        : builder.config.name
                    js = template.replace(templateRE, function (m, p1) {
                        return obj[p1]
                    })
                } else {
                    js = opt.noRequire
                        ? js
                        : obj.require + js
                }
                if (js) {
                    jsFile = new gutil.File({
                        cwd: file.cwd,
                        base: file.base,
                        path: file.base + filename + '.js',
                        relative: filename + '.js',
                        contents: new Buffer(js)
                    })
                }
            }

            if (builder.config.styles && css) {
                cssFile = new gutil.File({
                    cwd: file.cwd,
                    base: file.base,
                    path: file.base + filename + '.css',
                    relative: filename + '.css',
                    contents: new Buffer(css)
                })
            }

            if (jsFile && cssFile) {
                // manually emit because we need to pipe out two files
                stream.emit('data', jsFile)
                cb(null, cssFile)
            } else {
                cb(null, jsFile || cssFile)
            }
        })
    })

    return stream
}

component.scripts = function (opt) {
    opt.only = 'scripts'
    return component(opt)
}

component.styles = function (opt) {
    opt.only = 'styles'
    return component(opt)
}

module.exports = component