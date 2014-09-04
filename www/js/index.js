/* jshint browser:true, devel:true */
/* global $ */
/* global FastClick */
/* global mvLocalize */
/* global mvDevice */
/* global mvGetText */
/* global createMvImageLive */
/* global device */
/* global StatusBar */

$(document).on('mobileinit', function () {

  'use strict';

  var isPhoneGap = false;
  var isIOS = false;

  // PhoneGap events
  document.addEventListener('deviceready', function () {

    isPhoneGap = true;
    isIOS = device.platform === 'iOS' ? true : false;

    // pause event
    document.addEventListener('pause', function () {
      if (window.location.hash === '#image-live-page' && imageLive)
        imageLive.stop();
    }, false);

    // resume event
    document.addEventListener('resume', function () {
      if (window.location.hash === '#image-live-page' && imageLive)
        imageLive.start();
    }, false);

    // menu button event
    document.addEventListener('menubutton', function () {
      if (window.location.hash === '#image-live-page' && imageLive) {
        if (imageLivePanelIsOpened)
          $('#image-live-panel').panel('close');
        else
          $('#image-live-panel').panel('open');
      }
    }, false);
  }, false);

  // Use FastClick.
  FastClick.attach(document.body);

  // Translate all messages in current HTML.
  mvLocalize();
  
  // Set swipe configure for horizontal displacement.
  // On Samsung Galaxy S4 and G pro, swiperight event has bug.
  $.event.special.swipe.scrollSupressionThreshold = 5;

  // Disable all jQuery Mobile animation effects.
  // But, it causes the bug that button's active state is not restored.
  // So remove active state class from buttons forcibly.
  $.mobile.defaultPageTransition   = 'none';
  $.mobile.defaultDialogTransition = 'none';
  $(document).on('touchend', '.ui-btn', function (e) {
    this.removeClass($.mobile.activeBtnClass);
  });

  var currentDevice = null; //null = add, not null = edit
  var config = null;

  // Devce List page
  $(document).on('pagecreate', '#device-list-page', function () {

    function createDeviceItem(device) {
      var content = '<li>' +
        '<a href="#" data-uuid="' + device.uuid + '" class="device-list-item">' +
        '<img src="' + mvDevice.getThumbnail(device.uuid) + '">' +
        '<h2>' + device.name + '</h2>' +
        '<p>' + device.address + ' / ' + device.user + '</p>' +
        '</a>' +
        '<a href="#device-page" data-uuid="' +
        device.uuid + '" class="device-list-item-edit"></a>' +
        '</li>';
      return content;
    }

    var deviceListView = $('#device-list-view');

    var filterchk = false;
    $('#search-button').click(function () {
      if (filterchk) {
        deviceListView.filterable('destroy');
        filterchk = false;
      } else {
        deviceListView.filterable({
          create: function () {
            filterchk = true;
          }
        });
      }
    });

    // Show initial device list.
    $.each(mvDevice.list(), function (index, device) {
      deviceListView.append(createDeviceItem(device));
    });
    deviceListView.listview('refresh');
    
    // Click event
    $('#plus-button').click(function () {
      currentDevice = null;
    });
    $('#device-list-view').on('click',
                              '[data-uuid].device-list-item',
                              function () {

      // Get configuration and check the result.
      currentDevice = null;
      var device = mvDevice.get($(this).data('uuid'));
      $.ajax({
        url: 'http://' + device.address +
             ':' + device.httpPort +
             '/mjpeg.cgi?' +
             $.param( {
               getConfig: 'all',
               user: device.user,
               password: device.password,
             }, true),
        timeout: 5 * 1000
      }).done(function (data) {
        currentDevice = device;
        config = data;
        $.mobile.pageContainer.pagecontainer('change', '#image-live-page');
      }).fail(function (event) {

        if (currentDevice)
          return;

        console.log(event.status + ' ' + event.statusText);

        if (event.status == 200)
          return;

        var msg = '';
        switch (parseInt(/\d/.exec(event.responseText), 10)) {
          case 1:
            msg = mvGetText('auth-failure');
            break;
          case 2:
            msg = mvGetText('auth-invalid-channel');
            break;
          case 3:
            msg = mvGetText('auth-network-permission');
            break;
          case 4:
            msg = mvGetText('auth-channel-permission');
            break;
        }

        $('#message-popup p').html(mvGetText('connect-failure') +
                                    ': ' +
                                    event.statusText +
                                    ' (' + event.status + ')' +
                                    (msg !== '' ? '<br>' : '') + msg);
        $('#message-popup').show();
        $('#message-popup').popup('open', { positionTo: 'window' });
      });
    });
    $('#device-list-view').on('click',
                              '[data-uuid].device-list-item-edit',
                              function () {
      currentDevice = mvDevice.get($(this).data('uuid'));
    });

    // Handle device list change.
    mvDevice.onchange = function (event, idx, device) {
      var uuid = device.uuid;
      if (event === 'append') {
        deviceListView.append(createDeviceItem(device)).listview('refresh');
      } else if (event == 'remove') {
        $('[data-uuid="' + uuid + '"]').parent('li').remove();
      } else if (event == 'modify') {
        $('[data-uuid="' + uuid + '"].device-list-item h2').html(device.name);
        var desc = device.address + ' / ' + device.user;
        $('[data-uuid="' + uuid + '"].device-list-item p').html(desc);
        $('[data-uuid="' + uuid + '"].device-list-item img').attr('src', device.thumbnail);
      }
    };
  });

  // Device page
  $(document).on('pagecreate', '#device-page', function () {

    $('#name-text').attr('placeholder', mvGetText('name'));
    $('#address-text').attr('placeholder', mvGetText('address'));
    $('#port-text').attr('placeholder', mvGetText('http-port'));
    $('#user-text').attr('placeholder', mvGetText('user-name'));
    $('#password-text').attr('placeholder', mvGetText('password'));

    if (isPhoneGap)
      $('#address-text').attr('type', 'url');

    $('#device-input-form :input').on('change paste keyup', function () {
      if ($('#name-text').val() === '' ||
          $('#address-text').val() === '' ||
          $('#port-text').val() === '' ||
          $('#user-text').val() === '' ||
          $('#password-text').val() === '') {
        $('#device-add-button').attr('disabled', 'disabled');
      } else {
        $('#device-add-button').removeAttr('disabled');
      }
    });
    
    $('#device-remove-yes-button').click(function () {
      mvDevice.remove(currentDevice.uuid);
    });
        
    $('#device-input-form').submit(function (event) {
      event.preventDefault();
      
      var device = {
        name: $('#name-text').val(),
        address: $('#address-text').val(),
        httpPort: $('#port-text').val(),
        user: $('#user-text').val(),
        password: $('#password-text').val()
      };

      if (!currentDevice) {
        mvDevice.append(device);
      } else {
        $.extend(currentDevice, device);
        mvDevice.modify(currentDevice);
      }

      window.history.back();
    });
  });
  $(document).on('pagebeforeshow', '#device-page', function () {
    if (!currentDevice) {
      $('#device-input-form :input:not([id=port-text])').val('');
      $('#device-add-button').attr('disabled', 'disabled');
      $('#device-remove-button').hide();
      $('#device-add-button').text(mvGetText('add'));
      $('#device-title').text(mvGetText('new-device'));
    } else {
      var device = currentDevice;

      $('#name-text').val(device.name);
      $('#address-text').val(device.address);
      $('#port-text').val(device.httpPort);
      $('#user-text').val(device.user);
      $('#password-text').val(device.password);
      $('#device-add-button').removeAttr('disabled');
      $('#device-remove-button').show();
      $('#device-title').text(mvGetText('edit-device'));
      $('#device-add-button').text(mvGetText('ok'));
    }
  });
  $(document).on('pageshow', '#device-page', function () {
    if (!currentDevice)
      $('#name-text').focus();
  });
  
  // Create canvas context.
  var canvas = document.getElementById('image-live-canvas');
  var canvasColor = $(canvas).css('background-color');
  var ctx = canvas.getContext('2d');
  var imageLive = null;
  var lastMode = {};
  var currentMode = {};
  var currentCamera = 0;
  var lastCamera = 1;

  // Resize the canvas size according to window size.
  var resizeCanvasTimeout = 0;
  function resizeCanvas(width, height) {
    var $header = $('#image-live-header');
    var $content = $('#image-live-content');
    if (!width)
      width = $(window).width() -
              ($content.outerWidth() - $content.width());
    if (!height) {
      height = $(window).height() -
               ($content.outerHeight() - $content.height());
      if ($header.css('display') !== 'none') {
        height -= $header.outerHeight();
      }
    }
    if (width != canvas.width || height != canvas.height) {
      canvas.width = width;
      canvas.height = height;
      if (imageLive)
        imageLive.relayout(true);
    }

    resizeCanvasTimeout = 0;
  }
  $(window).on('resize', function () {
    if (resizeCanvasTimeout > 0) {
      clearTimeout(resizeCanvasTimeout);
      resizeCanvasTimeout = 0;
    }
    resizeCanvasTimeout = setTimeout(resizeCanvas, 500);
  });

  var imageLivePanelIsAnimating = false;
  var imageLivePanelIsOpened = false;
  $('#image-live-panel')
    .on('panelbeforeclose', function () {
      imageLivePanelIsAnimating = true;
      imageLivePanelIsOpened = false;
    })
    .on('panelbeforeopen', function () {
      imageLivePanelIsAnimating = true;
      imageLivePanelIsOpened = true;
    })
    .on('panelclose', function () {
      imageLivePanelIsAnimating = false;
    })
    .on('panelopen', function () {
      imageLivePanelIsAnimating = false;
    });

  function updateActiveCamera() {
    $('#image-live-camera-' + lastCamera).removeClass('ui-btn-active');
    $('#image-live-camera-' + currentCamera).addClass('ui-btn-active');

    // Set the camera name to the title of live page.
    var title = config.cameras[currentCamera - 1].name + ' - ' + currentDevice.name;
    $('#image-live-header h2').html(title);
    $('#image-live-panel-title').html(title);
  }

  function updateVisibleCameraGroup() {
    if (!imageLive)
      return;

    var cams = {};
    var views = imageLive.getViewCameras();
    var btn, cameraID, i;
    for (i = 0; i < views.length; i++) {
      cameraID = views[i];
      if (cameraID < 0)
        continue;
      cams[cameraID] = true;
    }
    for (i = 0; i < config.cameraTotal; i++) {
      btn = $('#image-live-camera-' + (i + 1));
      if (cams[i])
        btn.addClass('ui-btn-camera-visible');
      else
        btn.removeClass('ui-btn-camera-visible');
    }
  }

  // Save the canvas image data of thumbnail size.
  function saveThumbnail(uuid, image) {
    if (!uuid)
      return;
    var saveCanvas = document.getElementById('image-live-save-canvas');
    var ctx = saveCanvas.getContext("2d");

    saveCanvas.width = 120;
    saveCanvas.height = 65;
    ctx.drawImage(image,
                  0,
                  0,
                  saveCanvas.width,
                  saveCanvas.height);

    mvDevice.setThumbnail(uuid, saveCanvas.toDataURL());
  }

  // Image Live page
  $(document).on('pagecreate', '#image-live-page', function () {

    // Save the snapshot image of selected camera to Library or Gallery.
    function saveSnapshotImage() {
      var image = imageLive.getCameraImage(currentCamera - 1);
      if (!image)
        return;
      imageLive.stop();

      saveThumbnail(currentDevice.uuid, image);
      
      var saveCanvas = document.getElementById('image-live-save-canvas');
      var ctx = saveCanvas.getContext("2d");
      
      saveCanvas.width = image.width;
      saveCanvas.height = image.height;
      ctx.drawImage(image,
                    0,
                    0,
                    image.width,
                    image.height);

      window.canvas2ImagePlugin.saveImageDataToLibrary(
        function(msg) {
          $('#snapshot-popup p').html(mvGetText('snapshot-sucess'));
          $('#snapshot-popup').show();
          $('#snapshot-popup')
            .popup('open', { positionTo: 'window' })
            .fadeOut(3000, function () {
              $('#snapshot-popup').popup('close');
            });
          imageLive.start();
        },
        function(err) {
          $('#snapshot-popup p').html(mvGetText('snapshot-failure') +
                                     (err !== '' ? '<br>' : '') + err);
          $('#snapshot-popup').show();
          $('#snapshot-popup')
            .popup('open', { positionTo: 'window' })
            .fadeOut(3000, function () {
              $('#snapshot-popup').popup('close');
            });
          imageLive.start();
        },
        saveCanvas
      );
    }
    
    // Show snapshot save button only in mobile devices.
    if (!isPhoneGap) {
      $('#image-live-save-button').css('display', 'none');      
    }

    $('#image-live-save-button').on('click', function () {
      saveSnapshotImage();
    });
    $('#image-live-panel').on('click', '[id^=image-live-mode]', function () {
      var m = /\d+/.exec($(this).attr('id'));
      if (!m)
        return;
      var mode = parseInt(m[0]);
      if (imageLive)
        imageLive.setMode(mode, mode);
    });
    $('#image-live-panel').on('click', '[id^=image-live-camera]', function () {
      var c = /\d+/.exec($(this).attr('id'));
      if (!c)
        return;
      var camera = parseInt(c[0]) - 1;
      if (imageLive)
        imageLive.selectCamera(camera);
    });
    $('#image-live-fill').on('click', function () {
      var active = !$(this).hasClass('ui-btn-active');
      if (active)
        $(this).addClass('ui-btn-active');
      else
        $(this).removeClass('ui-btn-active');
      if (imageLive)
        imageLive.setFill(active);
    });
    $('#image-live-show-header').on('click', function () {
      var active = !$(this).hasClass('ui-btn-active');
      if (active)
        $(this).addClass('ui-btn-active');
      else
        $(this).removeClass('ui-btn-active');
      $('#image-live-header').css('display', active ? 'block' : 'none');
      resizeCanvas();
    });

    // Set click event handlers.
    $(canvas).click(function (e) {
      if (!imageLive)
        return;
      var offset = $('#image-live-canvas').offset();
      var pos = imageLive.getCameraforPoint(e.clientX - offset.left,
                                            e.clientY - offset.top);
      var camera = (pos.cameraID === undefined ? 0 : pos.cameraID);
      imageLive.selectCamera(camera);
    });

    // Set double click event handlers.
    $(canvas).doubletap(function () {
      if (!imageLive)
        return;
      var m = imageLive.getMode();
      if (m.rows == 1 && m.columns == 1)
        imageLive.setMode(lastMode.columns, lastMode.rows);
      else
        imageLive.setMode(1, 1);
    });
    
    // Set swipe right event handlers
    $(document).on('swiperight', '#image-live-page', function () {
      $('#image-live-panel').panel('open');
    });

    // Close the panel on clicking other area.
    $(document).on('click', '.ui-panel-dismiss', function () {
      $('#image-live-panel').panel('close');
    });
  });
  $(document).on('pagebeforeshow', '#image-live-page', function () {

    if (!currentDevice || !config)
      return;

    currentMode = { rows: 1, columns: 1};
    currentCamera = 1;

    // Calculate the maximum mode.
    var mm = 1;
    while (mm * mm < config.cameraTotal) { mm++; }

    // Show only valid mode buttons.
    var element;
    var i;
    for (i = 1; i <= 10; i++) {
      element = $('#image-live-mode-' + i);
      element.css('display', (i <= mm ? 'block' : 'none'));

      // Set default mode to active.
      if (i == currentMode.rows)
        element.addClass('ui-btn-active');
      else
        element.removeClass('ui-btn-active');
    }

    // Show only valid camera buttons.
    for (i = 1; i <= 100; i++) {
      element = $('#image-live-camera-' + i);
      element.css('display', (i <= config.cameraTotal ? 'block' : 'none'));

      // Set default camera to active.
      if (i == currentCamera)
        element.addClass('ui-btn-active');
      else
        element.removeClass('ui-btn-active');
    }
    $('#image-live-panel').trigger('updatelayout');

    // Limit initial double tap mode because the performanc of mobile device is
    // not good yet.
    if (mm > 2)
      mm = 2;
    lastMode = { rows: mm, columns: mm };

    // Create a new image live object.
    imageLive = createMvImageLive(canvas, $.extend({
      'isPhoneGap': isPhoneGap
    }, config, currentDevice));
    imageLive.ondraw = function (image, cam) {

      if (imageLivePanelIsAnimating)
        return;

      if (!currentDevice.thumbnail) {
        saveThumbnail(currentDevice.uuid, image);
      }

      ctx.drawImage(image,
                    cam.rect.x + 1, 
                    cam.rect.y + 1,
                    cam.rect.width - 2,
                    cam.rect.height - 2);
    };
    imageLive.onclear = function () {
      // On Samsung Galaxy S3, clearRect() has bug.
      if (!isPhoneGap || isIOS) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.save();
        ctx.fillStyle = canvasColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    };
    imageLive.ondrawselection = function (cam) {

      var mode = imageLive.getMode();
      if (mode.rows == 1 && mode.columns == 1)
        return;

      ctx.save();
      ctx.strokeStyle = '#ffce00';
      ctx.lineWidth = 1.0;
      ctx.strokeRect(cam.viewRect.x,
                     cam.viewRect.y,
                     cam.viewRect.width,
                     cam.viewRect.height);
      ctx.restore();
    };
    imageLive.onclearselection = function (cam) {
      var mode = imageLive.getMode();
      if (mode.rows == 1 && mode.columns == 1)
        return;

      ctx.save();
      ctx.strokeStyle = canvasColor;
      ctx.lineWidth = 2.0;
      ctx.strokeRect(cam.viewRect.x,
                     cam.viewRect.y,
                     cam.viewRect.width,
                     cam.viewRect.height);
      ctx.restore();
    };
    imageLive.onmodechange = function (mode) {
      $('#image-live-mode-' + currentMode.rows).removeClass('ui-btn-active');
      $('#image-live-mode-' + mode.rows).addClass('ui-btn-active');
      lastMode = currentMode;
      currentMode = mode;
      updateVisibleCameraGroup();
    };
    imageLive.oncamerachange = function (camera) {
      lastCamera = currentCamera;
      currentCamera = camera.id + 1;
      updateActiveCamera();
      updateVisibleCameraGroup();
    };

    // Hide canvas before initialization.
    resizeCanvas(1, 1);

    // Restore default parameters.
    imageLive.setFill($('#image-live-fill').hasClass('ui-btn-active'));
    imageLive.selectCamera(currentCamera - 1);
    imageLive.setMode(currentMode.rows, currentMode.columns);
    updateActiveCamera();
    updateVisibleCameraGroup();

    // Restore default button state.
    if ($('#image-live-header').css('display') === 'none')
      $('#image-live-show-header').removeClass('ui-btn-active');
    else
      $('#image-live-show-header').addClass('ui-btn-active');

    /* Hide iOS status bar. */
    if (isPhoneGap && isIOS)
      StatusBar.hide();
  });
  $(document).on('pageshow', '#image-live-page', function () {
    if (!imageLive) {
      window.history.back();
      return;
    }

    // Resize canvas again to apply page elements change.
    resizeCanvas();
    if (isPhoneGap && isIOS && resizeCanvasTimeout === 0) {
      // In iOS, status bar change is not yet applied this stage.
      resizeCanvasTimeout = setTimeout(resizeCanvas, 100);
    }

    // Start image live automatically.
    imageLive.start();
  });
  $(document).on('pagebeforehide', '#image-live-page', function () {

    /* Show iOS status bar again. */
    if (isPhoneGap && isIOS)
      StatusBar.show();

    if (!imageLive)
      return;

    imageLive.stop();
    imageLive.ondraw = null;
    imageLive.onclear = null;
    imageLive.ondrawselection = null;
    imageLive.onclearselection = null;
    imageLive.onmodechange = null;
    imageLive.oncamerachange = null;
    imageLive = null;
  });
});
