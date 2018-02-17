from django.conf.urls import url

from . import views

urlpatterns = [
    url(regex=r'^$', view=views.SpikeDataView,name='spike'),
    url(r'^data/$', views.data_list),
    url(r'^data/(?P<pk>[0-9]+)/$', views.data_detail),
    ]
