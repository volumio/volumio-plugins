let Nuimo =  require("./lib/nuimo.js"),
    nuimo = new Nuimo();

// Required for Max Compatibility
process.env.NOBLE_REPORT_ALL_HCI_EVENTS=1

nuimo.on("discover", (device) => {

    console.log(`Discovered Nuimo (${device.uuid})`);

    device.on("connect", () => {
        console.log("Nuimo connected");
    });

    device.on("disconnect", () => {
        console.log("Nuimo disconnected");
    });

    device.on("press", () => {
        console.log("Button pressed");
device.setLEDMatrix([
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 1, 0, 0, 1, 1, 0,
    0, 0, 0, 1, 0, 1, 0, 0, 0,
    0, 0, 0, 1, 0, 0, 1, 0, 0,
    0, 1, 0, 1, 0, 0, 0, 1, 0,
    0, 0, 1, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0
], 255, 2000);
    });

    device.on("release", () => {
        console.log("Button released");
    });

    device.on("swipe", (direction) => {
        switch (direction) {
            case (Nuimo.Swipe.LEFT):
                console.log("Swiped left"); break;
            case (Nuimo.Swipe.RIGHT):
                console.log("Swiped right"); break;
            case (Nuimo.Swipe.UP):
                console.log("Swiped up"); break;
            case (Nuimo.Swipe.DOWN):
                console.log("Swiped down"); break;
        }
    });

    device.on("touch", (direction) => {
        switch (direction) {
            case (Nuimo.Area.LEFT):
                console.log("Touched left"); break;
            case (Nuimo.Area.RIGHT):
                console.log("Touched right"); break;
            case (Nuimo.Area.TOP):
                console.log("Touched top"); break;
            case (Nuimo.Area.BOTTOM):
                console.log("Touched bottom"); break;
            case (Nuimo.Area.LONGLEFT):
                console.log("Long touched left"); break;
            case (Nuimo.Area.LONGRIGHT):
                console.log("Long touched right"); break;
            case (Nuimo.Area.LONGTOP):
                console.log("Long touched top"); break;
            case (Nuimo.Area.LONGBOTTOM):
                console.log("Long touched bottom"); break;
        }
    });

    device.on("rotate", (amount) => {
        console.log(`Rotated by ${amount}`);
    });

    device.on("fly", (direction, speed) => {
        switch (direction) {
            case (Nuimo.Fly.LEFT):
                console.log(`Flew left by speed ${speed}`); break;
            case (Nuimo.Fly.RIGHT):
                console.log(`Flew right by speed ${speed}`); break;
        }
    });

    device.on("detect", (distance) => {
        console.log(`Detected hand at distance ${distance}`);
    });

    device.connect();

});

nuimo.scan();
