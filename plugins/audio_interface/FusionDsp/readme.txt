FusionDsp for Volumio3 by b@lbuze https://github.com/balbuze
This folder and sub folders have been created the the plugin.

/FusionDsp
    |_/filters
    |_/filter-sources
    |_/target-curves
    |_/tools
    |_/peq

----------------------------------
/filters

Place filters you want to use in the plugin for correction.
supported formats :
    text- 32/64 bits floats line (.txt) in rephase
    FLOAT_LE- 32 bits floating point (.pcm)
    FLOAT64_LE- 64 bits IEEE-754 (.dbl) in rephase
    .wav files are directly converted in raw format to be used
---------------------------------   
/filter-sources

Place impulse you want to use for generating filter with DRC-FIR
Supported formats :
    32-bit mono wav (.wav)
    
--------------------------------    
/target-curves

Place the target curve you want to reach with DRC-FIR generated filter.
This a text file describing the curve. Check example provided.
Supported format
   text (.txt)

--------------------------------   
/tools

Files used for tools (pink noise and sweep). The folder is created if you install "tools".
Do not alter. Place here file you want to play to test.

--------------------------------
/peq

Place here EQ file exported as txt from REW to use it as local import EQ
