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
describe("#delete()", function() {
    beforeEach(function() {
    	fs.writeJsonSync("/tmp/delete.json",loadObj);
	var fileExists=fs.existsSync("/tmp/delete.json");
	expect(fileExists).to.equal( true );
    });
	
    it("Deleting a key", function(){
        var vconf=new (require(__dirname+'/../index.js'))();

        vconf.loadFile('/tmp/delete.json');
        vconf.delete('load.b');

        expect(vconf.data).to.deep.equal({
					  load: {
					    a: {
					      type: "number",
					      value: 100
					    },
					    c: {
					      type: "boolean",
					      value: false
					    }
					  }
					});
    });

    
    it("Deleting a key not in configuration", function(){
        var vconf=new (require(__dirname+'/../index.js'))();

        vconf.loadFile('/tmp/delete.json');
        
	vconf.delete('load.d');

        expect(vconf.data).to.deep.equal({
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
					});
    });
});
