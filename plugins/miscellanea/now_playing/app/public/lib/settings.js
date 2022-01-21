function setCSSVariables(data) {
  for (let [varName, value] of Object.entries(data)) {
    if (value == undefined || (typeof value === 'string' && value.trim() === '')) {
      value = `var(--default-${ varName })`;
    }
    document.documentElement.style.setProperty(`--${ varName }`, value);
  }
}

function applyCustomStyles(styles = {}) {
  let css = {
    'title-font-size': undefined,
    'artist-font-size': undefined,
    'album-font-size': undefined,
    'media-info-font-size': undefined,
    'title-font-color': undefined,
    'artist-font-color': undefined,
    'album-font-color': undefined,
    'media-info-font-color': undefined,
    'text-alignment-h': undefined,
    'text-alignment-v': undefined,
    'title-margin': undefined,
    'artist-margin': undefined,
    'album-margin': undefined,
    'media-info-margin': undefined,
    'max-title-lines': undefined,
    'max-artist-lines': undefined,
    'max-album-lines': undefined,
    'widget-primary-color': undefined,
    'widget-highlight-color': undefined,
    'playback-buttons-visibility': undefined,
    'seekbar-visibility': undefined,
    'playback-buttons-size': undefined,
    'playback-buttons-margin': undefined,
    'seekbar-margin': undefined,
    'albumart-visibility': undefined,
    'albumart-width': undefined,
    'albumart-height': undefined,
    'albumart-fit': undefined,
    'albumart-border-radius': undefined,
    'background-size': undefined,
    'background-position': undefined,
    'background-blur': undefined,
    'background-scale': undefined,
    'background-image': undefined,
    'background-color': undefined,
    'background-overlay-color': undefined,
    'background-overlay-opacity': undefined,
    'background-overlay-display': undefined
  };

  if (styles.fontSizes == 'custom') { 
    css['title-font-size'] = styles.titleFontSize;
    css['artist-font-size'] = styles.artistFontSize;
    css['album-font-size'] = styles.albumFontSize;
    css['media-info-font-size'] = styles.mediaInfoFontSize;
  }

  if (styles.fontColors == 'custom') { 
    css['title-font-color'] = styles.titleFontColor;
    css['artist-font-color'] = styles.artistFontColor;
    css['album-font-color'] = styles.albumFontColor;
    css['media-info-font-color'] = styles.mediaInfoFontColor;
  }

  if (styles.textAlignmentH) {
    css['text-alignment-h'] = styles.textAlignmentH;
  }

  if (styles.textAlignmentV) {
    css['text-alignment-v'] = styles.textAlignmentV;
  }
 
  if (styles.textMargins == 'custom') { 
    css['title-margin'] = styles.titleMargin;
    css['artist-margin'] = styles.artistMargin;
    css['album-margin'] = styles.albumMargin;
    css['media-info-margin'] = styles.mediaInfoMargin;    
  }

  if (styles.maxLines == 'custom') {
    css['max-title-lines'] = styles.maxTitleLines;
    css['max-artist-lines'] = styles.maxArtistLines;
    css['max-album-lines'] = styles.maxAlbumLines;
  }

  if (styles.widgetColors == 'custom') { 
    css['widget-primary-color'] = styles.widgetPrimaryColor;
    css['widget-highlight-color'] = styles.widgetHighlightColor;
  } 

  if (styles.widgetVisibility == 'custom') {
    if (!styles.playbackButtonsVisibility) {
      css['playback-buttons-visibility'] = 'none';
      css['seekbar-margin'] = 'auto 0px 0px 0px';
    }
    if (!styles.seekbarVisibility) {
      css['seekbar-visibility'] = 'none';
    }
  } 

  if (styles.playbackButtonSizeType == 'custom') { 
    css['playback-buttons-size'] = styles.playbackButtonSize;
  } 

  if (styles.widgetMargins == 'custom') { 
    css['playback-buttons-margin'] = styles.playbackButtonsMargin;
    css['seekbar-margin'] = styles.seekbarMargin;
  }  

  if (styles.albumartVisibility !== undefined && !styles.albumartVisibility) {
    css['albumart-visibility'] = 'none';
  } 

  if (styles.albumartSize == 'custom') { 
    css['albumart-width'] = styles.albumartWidth;
    css['albumart-height'] = styles.albumartHeight;
  } 

  if (styles.albumartFit) { 
    css['albumart-fit'] = styles.albumartFit;
  } 

  if (styles.albumartBorderRadius) { 
    css['albumart-border-radius'] = styles.albumartBorderRadius;
  } 

  if (styles.backgroundType == 'albumart') { 
    let albumartBackgroundFit = styles.albumartBackgroundFit || 'cover'; 
    let backgroundSize = albumartBackgroundFit == 'fill' ? '100% 100%' : albumartBackgroundFit; 
    let backgroundPosition = styles.albumartBackgroundPosition || 'center'; 
    let backgroundBlur = styles.albumartBackgroundBlur || '0px'; 
    let backgroundScale = styles.albumartBackgroundScale || '1'; 
    css['background-size'] = backgroundSize;
    css['background-position'] = backgroundPosition;
    css['background-blur'] = backgroundBlur;
    css['background-scale'] = backgroundScale;
  }
  else if (styles.backgroundType == 'volumioBackground' && styles.volumioBackgroundImage !== '') { 
    let volumioBackgroundFit = styles.volumioBackgroundFit || 'cover'; 
    let backgroundSize = volumioBackgroundFit == 'fill' ? '100% 100%' : volumioBackgroundFit; 
    let backgroundPosition = styles.volumioBackgroundPosition || 'center'; 
    let backgroundBlur = styles.volumioBackgroundBlur || '0px'; 
    let backgroundScale = styles.volumioBackgroundScale || '1'; 
    css['background-image'] = `url("${ getHost() }/backgrounds/${ styles.volumioBackgroundImage }")`;
    css['background-size'] = backgroundSize;
    css['background-position'] = backgroundPosition;
    css['background-blur'] = backgroundBlur;
    css['background-scale'] = backgroundScale;
  }
  else if (styles.backgroundType == 'color') {
    css['background-image'] = 'none';
    css['background-color'] = styles.backgroundColor || '#000';
  } 

  if (styles.backgroundOverlay == 'custom') { 
    css['background-overlay-color'] = styles.backgroundOverlayColor;
    css['background-overlay-opacity'] = styles.backgroundOverlayOpacity;
  }
  else if (styles.backgroundOverlay == 'none') { 
    css['background-overlay-display'] = 'none';
  }

  setCSSVariables(css);
}