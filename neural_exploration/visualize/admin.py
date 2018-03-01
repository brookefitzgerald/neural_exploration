from django.contrib import admin
from .models import Experiment, Site, Metadata, BinnedData

admin.site.register(Experiment)
admin.site.register(Site)
admin.site.register(BinnedData)
admin.site.register(Metadata)
