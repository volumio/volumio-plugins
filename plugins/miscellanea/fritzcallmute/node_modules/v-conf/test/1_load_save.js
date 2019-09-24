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

describe("#loadFile()", function() {
    beforeEach(function() {
    	fs.writeJsonSync("/tmp/loadFile.json",loadObj);
	    var fileExists=fs.existsSync("/tmp/loadFile.json");
	    expect(fileExists).to.equal( true );
    });


    it("File to load not found", function(){
        var vconf=new (require(__dirname+'/../index.js'))();

        vconf.loadFile('/tmp/missingFile.json');

        expect(vconf.data).to.deep.equal({});
        expect(vconf.filePath).to.equal('/tmp/missingFile.json');

    });

    it("File to load not found (asynchronously)", function(done){
        var vconf=new (require(__dirname+'/../index.js'))();

        vconf.loadFile('/tmp/missingFile.json',function(err,data)
        {
            expect(err).to.not.equal( null );
            expect(err).to.not.equal( undefined );
            expect(data).to.equal( undefined );
            done();
        });

    });

    it("File successfully read", function(){
        var vconf=new (require(__dirname+'/../index.js'))();

        vconf.loadFile('/tmp/loadFile.json');

        expect(vconf.data).to.deep.equal({
            load: {
                b: {
                    type: "string",
                    value: "A String"
                },
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
        expect(vconf.filePath).to.equal('/tmp/loadFile.json');

    });

    it("File successfully read (asynchronously)", function(done){
        var vconf=new (require(__dirname+'/../index.js'))();

        vconf.loadFile('/tmp/loadFile.json',function(err,data)
        {
            expect(err).to.equal( null );
            expect(data).to.deep.equal( loadObj );
            done();
        });

    });


});

describe("#scheduleSave()", function() {
    beforeEach(function() {
    	fs.removeSync("/tmp/scheduleSave.json");
	    var fileExists=fs.existsSync("/tmp/scheduleSave.json");
	    expect(fileExists).to.equal( false );
    });



    it("Successful save", function(done){
        this.timeout(6000);
        var vconf=new (require(__dirname+'/../index.js'))();
        vconf.autosaveDelay=5000;
            vconf.filePath="/tmp/scheduleSave.json";

        expect(vconf.filePath).to.equal( "/tmp/scheduleSave.json" );
            expect(vconf.autosaveDelay).to.equal( 5000 );

        vconf.scheduleSave();

        var fileExists=fs.existsSync("/tmp/scheduleSave.json");
        expect(fileExists).to.equal( false );

        setTimeout(function(){
            var fileExists=fs.existsSync("/tmp/scheduleSave.json");
            expect(fileExists).to.equal( true );
            done();
        },5000);
	
    });


    it("Successful save (asynchronous)", function(done){
        this.timeout(7000);
        var vconf=new (require(__dirname+'/../index.js'))();
        vconf.syncSave=false;
        vconf.autosaveDelay=5000;
        vconf.filePath="/tmp/scheduleSave.json";

        expect(vconf.filePath).to.equal( "/tmp/scheduleSave.json" );
        expect(vconf.autosaveDelay).to.equal( 5000 );

        vconf.scheduleSave();

        var fileExists=fs.existsSync("/tmp/scheduleSave.json");
        expect(fileExists).to.equal( false );

        setTimeout(function(){
            var fileExists=fs.existsSync("/tmp/scheduleSave.json");
            expect(fileExists).to.equal( true );
            done();
        },6000);

    });
});

describe("#save()", function() {
    beforeEach(function() {
    	fs.writeJsonSync("/tmp/save.json",{});
	var fileExists=fs.existsSync("/tmp/save.json");
	expect(fileExists).to.equal( true );
    });



    it("Data is saved to disk", function(){
	var vconf=new (require(__dirname+'/../index.js'))();
	vconf.filePath="/tmp/save.json";
	vconf.saved=false;

	var obj = fs.readJsonSync("/tmp/save.json");

	expect(vconf.saved).to.equal( false );
        expect(vconf.filePath).to.equal( "/tmp/save.json" );
	expect(obj).to.deep.equal( {} );

	vconf.data={
		    load: {
			a: {
			    type: "number",
			    value: 100
			}
		    }
	};
	vconf.save();
	
	obj = fs.readJsonSync("/tmp/save.json");

	expect(obj).to.deep.equal( {
		    load: {
			a: {
			    type: "number",
			    value: 100
			}
		    } });
	
    });

    it("Data is not saved to disk", function(){
	var vconf=new (require(__dirname+'/../index.js'))();
	vconf.filePath="/tmp/save.json";
	vconf.saved=true;

	var obj = fs.readJsonSync("/tmp/save.json");

	expect(vconf.saved).to.equal( true );
    expect(vconf.filePath).to.equal( "/tmp/save.json" );
	expect(obj).to.deep.equal( {} );

	vconf.data={
		    load: {
			a: {
			    type: "number",
			    value: 100
			}
		    }
	};
	vconf.save();
	
	obj = fs.readJsonSync("/tmp/save.json");

	expect(obj).to.deep.equal( {});
	
    });
});


describe("#atomicsave()", function() {
        beforeEach(function() {
            fs.writeJsonSync("/tmp/save.json",{});
            var fileExists=fs.existsSync("/tmp/save.json");
            expect(fileExists).to.equal( true );
        });


        it("Data is saved to disk (SYNC)", function(){
            var vconf=new (require(__dirname+'/../index.js'))();
            vconf.filePath="/tmp/save.json";
            vconf.saved=false;
            vconf.syncSave=true;
            vconf.atomicSave=true;

            var obj = fs.readJsonSync("/tmp/save.json");

            expect(vconf.saved).to.equal( false );
            expect(vconf.filePath).to.equal( "/tmp/save.json" );
            expect(obj).to.deep.equal( {} );

            vconf.data={
                    load: {
                    a: {
                        type: "number",
                        value: 100
                    }
                    }
            };
            vconf.save();
        
            obj = fs.readJsonSync("/tmp/save.json");

            expect(obj).to.deep.equal( {
                    load: {
                    a: {
                        type: "number",
                        value: 100
                    }
                    } });
        
        });

        it("Data is saved to disk (ASYNC)", function(done){
            this.timeout(7000);
            var vconf=new (require(__dirname+'/../index.js'))();
            vconf.filePath="/tmp/save.json";
            vconf.saved=false;
            vconf.syncSave=false;
            vconf.atomicSave=true;

            var obj = fs.readJsonSync("/tmp/save.json");

            expect(vconf.saved).to.equal( false );
            expect(vconf.filePath).to.equal( "/tmp/save.json" );
            expect(obj).to.deep.equal( {} );

            vconf.data={
                    load: {
                    a: {
                        type: "number",
                        value: 100
                    }
                    }
            };
            vconf.save();
        
            setTimeout(function(){
                obj = fs.readJsonSync("/tmp/save.json");

                expect(obj).to.deep.equal( {
                        load: {
                        a: {
                            type: "number",
                            value: 100
                        }
                        } });
                done();
            },1000);
        
        });

        it("Data is not saved to disk", function(){
            var vconf=new (require(__dirname+'/../index.js'))();
            vconf.filePath="/tmp/save.json";
            vconf.saved=true;
            vconf.atomicSave=true;

            var obj = fs.readJsonSync("/tmp/save.json");

            expect(vconf.saved).to.equal( true );
            expect(vconf.filePath).to.equal( "/tmp/save.json" );
            expect(obj).to.deep.equal( {} );

            vconf.data={
                    load: {
                    a: {
                        type: "number",
                        value: 100
                    }
                    }
            };
            vconf.save();
            
            obj = fs.readJsonSync("/tmp/save.json");

            expect(obj).to.deep.equal( {});
        
        });
});
