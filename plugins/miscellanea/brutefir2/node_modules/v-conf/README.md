[![bitHound Overall Score](https://www.bithound.io/github/fanciulli/v-conf/badges/score.svg)](https://www.bithound.io/github/fanciulli/v-conf)  [![bitHound Dependencies](https://www.bithound.io/github/fanciulli/v-conf/badges/dependencies.svg)](https://www.bithound.io/github/fanciulli/v-conf/master/dependencies/npm)

# v-conf
An easy to use library for managing configuration parameters. V-conf was born inside the [Volumio](http://volumio.org 'The volumio project website') project
and then has been migrated to a separate library. 

The idea behind v-conf is to provide an easy way to manage configuration parameters. Main functionalities are:

* Configuration parameters can be organized in a hierarchy
* Optionally store data on file
* Data is automatically saved after a configurable amount of time
* Data write is reduced by delaying disk writes
* Callbacks can be associated to configuration keys.


##Contacts

<a href="https://twitter.com/fanciullim" class="twitter-follow-button" data-show-count="false" data-size="large">Follow @fanciullim</a> <script>!function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0],p=/^http:/.test(d.location)?'http':'https';if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src=p+'://platform.twitter.com/widgets.js';fjs.parentNode.insertBefore(js,fjs);}}(document, 'script', 'twitter-wjs');</script>

##Installation

To install it include the library in your package.json as follows (replacing VERSION with latest version number)

    {
        "name": "test",
        "version": "1",
        "dependencies": {
            "v-conf": "VERSION"
        }
    }

and then run 

    npm install
    
In your package.json pick latest version if you don't need a specific one.

If you want to install the library manually run the following command on the root of your project

    npm install v-conf
   
or install v-conf globally

    npm install -g v-conf
    
##Usage

###Initialization

V-conf needs to be instantiated somewhere in your code. 

    var config=new (require('v-conf'))();
    
Then you can decide whether creating your data structure manually or load it from disk. 
A configuration value can be added as follows:

    config.addConfigValue('my.configuration.value','boolean',false);
    
Instead a configuration file can be loaded by executing
 
    config.loadFile(__dirname+'/testConfig.json');
    
If you load the configuration from file you automatically activate the autosave option. This option saves the updated configuration after
a configured amount of time. This allows grouping write option thus saving your SD card (in case you run the code on a device like a
Raspberry PI)

###Key structure

As shown by the addConfigValue example above the configuration values are organized in a tree structure. This allows grouping of data.
The method addConfigValue automatically creates the missing structures for you.

The following code

     config.addConfigValue('groupa.configuration','boolean',false);
     config.addConfigValue('groupb.configuration','boolean',true);
     
creates an internal representation like the following

    {
        "groupa":
                {
                    "configuration":{
                                     "type":"boolean",
                                     "value":false
                                     }
                },
        "groupb":
                {
                    "configuration":{
                                     "type":"boolean",
                                     "value":true
                                     }
                }
        }
        
###Data types

Supported types are: boolean, string, number, array

###Methods

####addConfigValue(key,type,value)

Adds a configuration key to the structure.

* key:   the key for the configuration values you're about to add. If key  is an array don't provide any index, item is added at the end of the array
* type:  one of the supported data types
* value: the current value

Example:

    config.addConfigValue('groupa.configuration','boolean',false);
or
    config.addConfigValue('groupa.configuration','array',false);

####set(key,value)

Updates the value of the key. If the key doesn't exists, the method creates it inferring the value type.

* key:   the key of an existing configuration values. If item is an array, provide the index.
* value: the value to set

Example:

    config.set('groupa.configuration',false);
    config.set('groupa.configuration.items[1]','my string');
    
####get(key)

Retrieves the current value for the specified key.

* key:   the key of an existing configuration values

Returns the value associated to the key or undefined

Example:

    var values=config.get('groupa.configuration');
    
####delete(key)

Deletes the configuration parameter specified by the key.

* key:   the key of an existing configuration values

Example:

    config.delete('groupa.configuration');
    
####has(key)

This method checks the existence of a key

* key:   the key to check

Returns eturns true or false depending on the existence of a key in the configuration file

Example:

    var exists=config.has('groupa.configuration');    
    
####getKeys(key)

Lists all the children keys of the specified one.

* key:   the key of an existing configuration values

Example:

    var keys=config.getKeys('groupa.configuration');
    
####registerCallback(key, callback)

Register a callback function to be executed when the value is updated

* key:   the key of an existing configuration values that you want to be notified of its value change
* callback: a callback function that will be invoked when the value is updated. The new value is passed to the function.
            

Example:

    config.registerCallback('groupa.configuration',function(data)
                             {
                                console.log('NEW VALUE: '+data);
                             });
