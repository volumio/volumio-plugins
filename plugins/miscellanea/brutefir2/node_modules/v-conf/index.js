/**
 * Created by Massimiliano Fanciulli on 27/07/15.
 * If you need any information write me at fanciulli@gmail.com
 */
var fs=require('fs-extra');
var Multimap = require('multimap');
var atomicwrite = require('write-file-atomic');
var atomicwritesync = require('write-file-atomic').sync;

module.exports=Config;

function Config()
{
    var self=this;

    self.syncSave=true;
    self.autosave=true;
    self.autosaveDelay=1000;
    self.saved=true;
    self.atomicSave=false;
    self.data={};

    self.callbacks=new Multimap();
}


/**
 * This method loads the configuration from a file. If the file is not found or cannot be opened for some reason,
 * the content is set to empty. The method is synchronous if no callback is provided, asynchronous otherwise
 * @param file The path of the configuration file to load.
 * @param callback Callback method that is invoked when load is completed. Function shall accept (err,data)
 */
Config.prototype.loadFile=function(file,callback)
{
    var self=this;

    self.filePath=file;

    try
    {
        if(callback === undefined)
            self.data=fs.readJsonSync(file);
        else
        {
            fs.readJson(file,function(err,data){
                if(err)
                    callback(err);
                else
                {
                    self.data=data;
                    callback(err,data);
                }
            });
        }
    }
    catch(ex)
    {
        self.data={};
    }

};

/**
 * This method searches the object associated to the provided key.
 * @param key Key to search. A string object
 * @returns The value associate to the key. If not key is given the whole configuration is
 * returned. If key doesn't exist a null value is returned
 */
Config.prototype.findProp=function(key)
{
    var self=this;

    if(key===undefined)
        return self.data;
    else
    {
        var splitItems=key.split('.');
        var currentProp=self.data;

        while (splitItems.length > 0) {
            var k = splitItems.shift();

            var beginArrayIndex=k.indexOf('[');
            var endArrayIndex=k.indexOf(']');

            if(beginArrayIndex>-1 && endArrayIndex>-1)
            {
                // shall get an array item
		var itemStr=k.substring(0,beginArrayIndex);
		var indexStr=parseInt(k.substring(beginArrayIndex+1,endArrayIndex).trim());
		currentProp=currentProp[itemStr];
		currentProp=currentProp.value[indexStr];
            }
            else
            {
                if(currentProp && currentProp[k]!==undefined)
                    currentProp=currentProp[k];
                else
                {
                    currentProp=null;
                    break;
                }
            }
        }

        return currentProp;
    }
};

/**
 * This method returns true or false depending on the existence of a key in the configuration file
 * @param key Key to check
 * @returns {boolean} True if key exists, false otherwise
 */
Config.prototype.has=function(key)
{
    var self=this;
    var prop=self.findProp(key);

    return prop!==null && prop!==undefined;
};


/**
 * This method returns the object associated to the key
 * @param key Object to return
 * @param def Default value if key is not found
 * @returns The value associated to key, default if not found and passed to method, undefined otherwise.
 */
Config.prototype.get=function(key,def)
{
    var self=this;
    var prop=self.findProp(key);

    if(prop!==undefined && prop
        !== null)
        return self.forceToType(prop.type,prop.value);
    else return def;
};

/**
 * This method sets the provided value to the key.
 * @param key Key to update
 * @param value The value to set
 */
Config.prototype.set=function(key,value)
{
    var self=this;
    var prop=self.findProp(key);

    if(prop!==undefined && prop !== null)
    {
        prop.value=self.forceToType(prop.type,value);
        self.scheduleSave();
    }
    else if(value!==undefined && value!==null)
    {
        var type=typeof value;
        self.addConfigValue(key,type,value);
    }

    self.callbacks.forEach(function (callback, ckey) {
        if(key==ckey)
        {
            callback(value);
        }
    });

};

/**
 * This method schedules saving the internal data to disk. Dump to disk is done if a file path is set.
 */
Config.prototype.scheduleSave=function()
{
    var self=this;

    if(self.filePath!==undefined)
    {
        self.saved=false;

        setTimeout(function()
        {
            self.save();
        },self.autosaveDelay);
    }

};

/**
 * This method saves the data to disk.
 */
Config.prototype.save=function()
{
    var self=this;

    if(self.saved===false)
    {
        self.saved=true;

        if(self.syncSave)
	    {
    		if(self.atomicSave)
    		{
               atomicwritesync(self.filePath, JSON.stringify(self.data));
    		}
    		else
    		{
    			fs.writeJsonSync(self.filePath,self.data);
    		}    
	    }
        else 
            {
                if(self.atomicSave)
                {
                   atomicwrite(self.filePath, JSON.stringify(self.data),{},function(err){ 
                        if(err)console.log("Atomic write error: "+err);
                    });
                }
                else
                {
                    fs.writeJson(self.filePath,self.data);
                }
            }
    }
};

/**
 * This method add a configuration to the internal data.
 * @param key Key to add
 * @param type Type of the parameter to add
 * @param value The value of the parameter to add
 */
Config.prototype.addConfigValue=function(key,type,value)
{
    var self=this;

    var splitted=key.split('.');
    var currentProp=self.data;

    while (splitted.length > 0) {
        var k = splitted.shift();

	    var beginArrayIndex=k.indexOf('[');
        var endArrayIndex=k.indexOf(']');

        if(beginArrayIndex>-1 && endArrayIndex>-1)
        {
		    throw new Error('Cannot provide index to array');
	    }
	    else
	    {
		    if(currentProp && currentProp[k]!==undefined)
		        currentProp=currentProp[k];
		    else
		    {
		        if(type==='array')
		        {
			        currentProp[k]={type:'array',value:[]};
		        }
		        else
		        {
			        currentProp[k]={};
		    	    currentProp=currentProp[k];
		        }
		    }
	    }

    }

    var prop=self.findProp(key);
    self.assertSupportedType(type);

    if(type==='array')
    {
        prop.value.push({type:typeof value,value:value});
    }
    else
    {
        prop.type=type;
        prop.value=self.forceToType(type,value);
    }


    self.scheduleSave();
};

/**
 * This method checks if the type passed as parameter is supported by the library
 * @param type type to check
 */
Config.prototype.assertSupportedType=function(type)
{
    if(type != 'string' && type!='boolean' && type!='number' && type!='array')
    {
        throw Error('Type '+type+' is not supported');
    }
};

/**
 * This method forces the value passed
 * @param key type to force value to
 * @param value The value to be forced
 */
Config.prototype.forceToType=function(type,value)
{
    if(type=='string')
    {
        return ''+value;
    }
    else if(type=='boolean')
    {
        return Boolean(value);
    }
    else if(type=='number')
    {
        var i = Number(value);
        if(Number.isNaN(i))
            throw  Error('The value '+value+' is not a number');
        else return i;
    }
    else if(type=='array')
    {
    	return [{type:typeof value,value:value}];
    }
    else return value;

};

/**
 * This method prints the internal data to console
 */
Config.prototype.print=function()
{
    var self=this;

    console.log(JSON.stringify(self.data));
};

/**
 * This method searches for the key and deletes it
 * @param key
 */
Config.prototype.delete=function(key)
{
    var self=this;

    if(self.has(key))
    {
        var splitted=key.split('.');

        if(splitted.length==1)
            delete self.data[key];
        else
        {
            var parentKey=self.data;
            for(var i=0;i< splitted.length;i++)
            {
                var k = splitted.shift();
                parentKey=parentKey[k];
            }

            var nextKey=splitted.shift();
            delete parentKey[nextKey];
        }

        self.scheduleSave();
    }

    self.callbacks.delete(key);
};

/**
 * This method returns all the keys children to the one apssed a parameter
 * @param key key to evaluate
 */
Config.prototype.getKeys=function(parentKey)
{
    var self=this;

    var parent=self.findProp(parentKey);

    if(parent!==undefined && parent!==null)
        return Object.keys(parent);
    else return Object.keys(self.data);
};

/**
 * This method registers callbacks for set and delete
 * @param key Key to associate callback to
 * @param value The callback method to run
 */
Config.prototype.registerCallback=function(key,callback)
{
    var self=this;

    self.callbacks.set(key,callback);
};
