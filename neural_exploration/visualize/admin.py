from django.contrib import admin
from .models import Data, Experiment, Site, Metadata

admin.site.register(Data)
admin.site.register(Experiment)
admin.site.register(Site)
admin.site.register(Metadata)
