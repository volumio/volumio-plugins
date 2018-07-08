module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    jshint:{
      options: {
        jshintrc: true
      },
      src: ['lcd.js', 'test/**/*.js']
    },
    mochaTest: {
      options: {
        reporter: 'spec',
        quiet: false
      },
      src: ['tests/**/*.js']
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task(s).
  grunt.registerTask('default', ['jshint', 'mochaTest']);
  grunt.registerTask('test', ['mochaTest']);

};