from django.conf.urls import url

from . import views

urlpatterns = [
    url(regex=r'^$', view=views.SpikeDataView,name='spike'),
    url(r'^data/$', views.data_list),
    url(r'^data/(?P<pk>[0-9]+)/$', views.data_detail),
    url(r'^bin/(?P<i>[1-3])/$', views.binned_filter_list),
    url(r'^bin/(?P<i>[1-3])/(?P<pk>[0-9]+)/$', views.binned_filter_detail),
    url(r'^anova/(?P<i>[1-3])/$', views.anova_from_bin_list)
    ]
