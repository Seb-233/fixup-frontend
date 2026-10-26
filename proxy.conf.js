module.exports = [
  {
    context: [
      '/auth',
      '/demo',
      '/payments',
      '/requests',
      '/quotations',
      '/jobs',
      '/media',
      '/fixers',
      '/properties',
      '/locations',
      '/contracts',
      '/notifications',
      '/remodelings',
      '/administration',
      '/management',
      '/visits',
      '/ratings',
      '/analytics'
    ],
    target: 'http://localhost:8080',
    secure: false,
    changeOrigin: true,
    bypass: function (req) {
      if (req.headers.accept && req.headers.accept.indexOf('html') !== -1) {
        return '/index.html';
      }
    }
  }
];
