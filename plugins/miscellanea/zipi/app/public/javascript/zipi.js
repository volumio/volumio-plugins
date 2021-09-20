let navButtonDefaults;

function setView(data) {
  clearAlerts();
  setStatusText('');
  setStepsBarActiveStep(data.step);
  $('#contents').html(data.contents);
}

function addAlert(message, type) {
  let alertContainer = $('<div></div>').addClass('alert');
  alertContainer.addClass(type);
  alertContainer.html(message);
  $('#alerts').append(alertContainer);
}

function clearAlerts() {
  $('#alerts').html('');
}

function setNavButtonDefaults(values) {
  navButtonDefaults = values;
}

function configureNavButton(type, options = {}) {
  let button = $(`#nav .${ type }`);
  if (button.length == 0) {
    return;
  }

  let opts = Object.assign({}, navButtonDefaults[type], options);

  button.off('click');
  if (opts.onClick) {
    button.on('click', opts.onClick);
  }

  button.prop('disabled', opts.disabled);
  button.html(opts.text);

  if (opts.hidden) {
    button.hide();
  }
  else {
    button.show();
  }
}

function setStatusText(text, icon) {
  let html = text;
  if (icon) {
    html = `<i class="${ icon }"></i>` + html;
  }
  $('#status').html(html);
}

const stepsBarProgressLineStartWidth = 12.5;
const stepsBarProgressLineIncrementWidth = 25;

function setStepsBarActiveStep(step) {
  let stepsBarSteps = $('.stepsbar .stepsbar-step');

  let progressLineWidth;
  if (step == stepsBarSteps.length) {
    progressLineWidth = 100;
  }
  else {
    progressLineWidth = stepsBarProgressLineStartWidth + 
    ((step - 1 ) * stepsBarProgressLineIncrementWidth);
  }
  $('.stepsbar .stepsbar-progress .stepsbar-progress-line').css('width', `${ progressLineWidth }%`);

  stepsBarSteps.each( (index, el) => {
    el = $(el);
    if (index + 1 < step) {
      el.addClass('activated');
      el.removeClass('active');
    }
    else if (index + 1 == step) {
      el.addClass('active');
      el.removeClass('activated');
    }
    else {
      el.removeClass('active activated');
    }
  });
}

function openDialog(id) {
  let dialog = $(`#${ id }`);
  if (dialog.length > 0) {
    dialog.dialog('open');
    dialog.dialog('widget')
    .css({ position: 'fixed' })
    .position({
        my: 'center bottom',
        at: 'center center-50px',
        of: window
    });
  }
}
