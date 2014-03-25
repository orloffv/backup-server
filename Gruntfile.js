module.exports = function(grunt) {
    "use strict";
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        config: grunt.file.readJSON('config/config.json'),
        clean: {
            data: ['data/']
        },
        compress: {
            mongodb: {
                options: {
                    mode: 'zip',
                    archive: 'data/mongodb.zip'
                },
                files:[
                    {
                        expand: true,
                        cwd: 'data/',
                        src: ['mongodb/**/*']
                    }
                ]
            }
        },
        dropbox: {
            mongodb: {
                path: '/backup/',
                type: 'mongodb',
                file: 'data/mongodb.zip'
            }
        },
        shell: {
            mongodb: {
                command: 'mongodump --host <%= config.mongodb.host %> --username <%= config.mongodb.username %> --password <%= config.mongodb.password %> --db <%= config.mongodb.db %> --out data/mongodb',
                options: {
                    execOptions: {
                        cwd: './'
                    }
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-compress');
    grunt.loadNpmTasks('grunt-shell-spawn');

    grunt.registerTask('backup:mongodb', [
        'clean:data',
        'shell:mongodb',
        'compress:mongodb',
        'dropbox:mongodb',
        'clean:data'
    ]);

    grunt.registerMultiTask('dropbox', function() {
        var Dropbox = require("dropbox"), fs = require('fs'), done = this.async();

        var dropboxClient = new Dropbox.Client({
            key: grunt.config('config.dropbox.key'),
            secret: grunt.config('config.dropbox.secret'),
            token: grunt.config('config.dropbox.token')
        });

        var DbHelper = function() {};

        DbHelper.prototype = {
            auth: function(callback) {
                dropboxClient.authenticate(function(error, client) {
                    if (error) {
                        return grunt.log.error('Dropbox:', error);
                    }

                    if (client.isAuthenticated()) {
                        callback(client);
                    } else {
                        return grunt.log.error('Dropbox:', 'could not auth');
                    }
                });
            },
            uploadFile: function(client, path, type, callback) {
                var now = new Date();
                var fileName = now.getDate() + '_' +  (now.getMonth() + 1) + '_' + now.getFullYear() + '_' + now.getHours() + now.getMinutes() + now.getSeconds();

                client.getAccountInfo(function(error, userInfo) {
                    var fileSize = fs.statSync(path).size;
                    if (userInfo.quota > fileSize) {
                        fs.readFile(path, function(error, data) {
                            if (error) {
                                return grunt.log.error('readFile:', error);
                            }

                            client.writeFile(type + '/' + fileName + '.zip', data, function(error, state) {
                                if (error) {
                                    return grunt.log.error('Dropbox:', error);
                                }

                                callback(state);
                            });
                        });
                    } else {
                        return grunt.log.error('Dropbox:', 'not enough space');
                    }
                });
            }
        };

        var dbHelper = new DbHelper();

        var data = this.data;

        dbHelper.auth(function(client) {
            dbHelper.uploadFile(client, data.file, data.path + data.type, function(state) {
                grunt.log.ok('Dropbox:', 'file uploaded', state.path, state.humanSize);
                done();
            });
        });
    });

    grunt.registerTask('default', function() {
        var _tasks, tasks, table;

        grunt.log.header('Available tasks');

        _tasks = [];
        Object.keys(grunt.task._tasks).forEach(function(name) {
            var task = grunt.task._tasks[name];
            if (task.meta.info === 'Gruntfile' && !task.multi && name !== 'default') {
                _tasks.push(task);
            }
        });

        tasks = _tasks.map(function(task) {
            var info = task.info;
            if (task.multi) { info += ' *'; }
            return [task.name, info];
        });

        table = function(arr) {
            arr.forEach(function(item) {
                grunt.log.writeln(grunt.log.table([30, 120], [item[0], item[1]]));
            });
        };

        table(tasks);

        grunt.log.writeln().writeln('For production need add a key \'--env=prod\'');
    });
};
