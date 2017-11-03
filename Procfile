web: gunicorn config.wsgi:application
worker: celery worker --app=neural_exploration.taskapp --loglevel=info
