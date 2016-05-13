module.exports = function (grunt) {
  grunt.initConfig({
    shipit: {
      options: {
        workspace: '/tmp/github-monitor',
        deployTo: '/var/flames/source',
        repositoryUrl: 'https://github.com/Pablo-Merino/flame.git',
        ignores: ['.git', 'node_modules'],
        rsync: ['--del'],
        keepReleases: 2,
        key: '~/.ssh/id_rsa',
        shallowClone: true
      },
      beta: {
        servers: ['pmerino@docker0.dokku.eu']
      }
    }
  });

  grunt.loadNpmTasks('grunt-shipit');
  grunt.loadNpmTasks('shipit-deploy');

  grunt.registerTask('pwd', function () {
    grunt.shipit.remote('pwd', this.async());
  });

  grunt.registerTask('start', function () {
    var done = this.async();
    var current = grunt.config('shipit.options.deployTo') + '/current';
    grunt.shipit.remote('cd ' + current + ' && forever start index.js', done);
  });
};