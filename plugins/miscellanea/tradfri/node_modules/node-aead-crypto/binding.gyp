{
    "targets": [
        {
            "target_name": "node-aead-crypto",
            "sources": [
                "src/node-aes-ccm.cc",
                "src/node-aes-gcm.cc",
                "src/addon.cc"
            ],
            'include_dirs' : [
                "<!(node -e \"require('nan')\")"
            ],
            'conditions': [
                [ 'OS=="win"', {
                    'defines': [
                        'uint=unsigned int',
                    ],
                }],
            ],
        }
    ]
}
