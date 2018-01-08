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

describe("#forceToType()", function() {
    it("Testing numbers", function(){
	var vconf=new (require(__dirname+'/../index.js'))();
	
	expect(vconf.forceToType('string',3)).to.equal( '3' );
	expect(vconf.forceToType('boolean',3)).to.equal( true );	
	expect(vconf.forceToType('boolean',0)).to.equal( false );	
	expect(vconf.forceToType('number',3)).to.equal( 3 );
    });

    it("Testing strings", function(){
	var vconf=new (require(__dirname+'/../index.js'))();
	
	expect(vconf.forceToType('string','3')).to.equal( '3' );
	expect(vconf.forceToType('boolean','3')).to.equal( true );	
	expect(vconf.forceToType('number','3')).to.equal( 3 );
	expect(vconf.forceToType.bind(vconf,'number','a')).to.throw( 'The value a is not a number' );
    });

    it("Testing booleans", function(){
	var vconf=new (require(__dirname+'/../index.js'))();
	
	expect(vconf.forceToType('string',true)).to.equal( 'true' );
	expect(vconf.forceToType('string',false)).to.equal( 'false' );
	expect(vconf.forceToType('boolean',true)).to.equal( true );	
	expect(vconf.forceToType('number',true)).to.equal( 1 );
	expect(vconf.forceToType('number',false)).to.equal( 0 );
    });
});
