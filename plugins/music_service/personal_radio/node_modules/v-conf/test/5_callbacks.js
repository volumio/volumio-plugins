var expect = require("chai").expect;
var fs=require('fs-extra');

var loadObj={
  load: {
    a: {
      type: "number",
      value: 100
    },
    b: {
      type: "string",
      value: "A String"
    },
    c: {
      type: "boolean",
      value: false
    }
  }
};

/**
 * DELETE
 */
describe("#registerCallback()", function() {
    beforeEach(function() {
    	fs.writeJsonSync("/tmp/callbacks.json",loadObj);
        var fileExists=fs.existsSync("/tmp/callbacks.json");
        expect(fileExists).to.equal( true );
    });
	
    it("Registering a callback", function(){
        var vconf=new (require(__dirname+'/../index.js'))();

        vconf.loadFile('/tmp/callbacks.json');
        vconf.registerCallback('load.b',function(){});

        expect(vconf.callbacks.has( 'load.b' )).to.equal( true );
    });

    it("Callback on set", function(done){
        var vconf=new (require(__dirname+'/../index.js'))();

        vconf.loadFile('/tmp/callbacks.json');
        vconf.registerCallback('load.b',function(value){
		expect(value).to.equal( 'SET' );
		done();
	});

	vconf.set('load.b','SET');
    });

    
    
});
