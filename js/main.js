// Main script that created objects, initializes them and connects with each other.
// To be launched at the end of HTML document

var image = new Visic.Image('image');
image.update();
    
var synthesizer = new Visic.Synthesizer('image');
    
var player = Visic.player;
//player.onReady.add(function () {
    //player.test();
//});

var gaze = Visic.gaze;
gaze.onFixationEnded.add(function (coords, duration) {
    synthesizer.putNote(coords, duration);
});
gaze.onStarted.add(function () {
    synthesizer.reset();
});
gaze.onStopped.add(function () {
    player.playSequence(synthesizer.notes);
    //player.test();
});
