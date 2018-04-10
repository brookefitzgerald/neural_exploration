from django.apps import apps
from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import FieldDoesNotExist
from django.db import models

import numpy as np
from scipy.stats import f_oneway


class Experiment(models.Model):
    """Information about each experiment"""
    slug = models.CharField(max_length=30, unique=True)
    name = models.TextField()
    description = models.TextField()
    index_stimulus_shown = models.IntegerField()

    def __str__(self):
        return self.name


class Site(models.Model):
    """Site that data was recorded at"""
    experiment = models.ForeignKey(
        Experiment,
        on_delete=models.CASCADE
    )
    slug = models.CharField(max_length=30)

    labels_one = ArrayField(models.CharField(max_length=30, null=True, blank=True),
        null=True, blank=True)
    labels_two = ArrayField(models.CharField(max_length=30, null=True, blank=True),
        null=True, blank=True)
    labels_three = ArrayField(models.CharField(max_length=30, null=True, blank=True),
        null=True, blank=True)
    labels_four = ArrayField(models.CharField(max_length=30, null=True, blank=True),
        null=True, blank=True)
    data = ArrayField(
            ArrayField(
                    models.DecimalField(max_digits=15, decimal_places=10),
                blank=True, null=True),
            blank=True, null=True)

    def __str__(self):
        return str(self.experiment.slug + '-' + self.slug)

    def filter_by_label(self, experiment, input_label, label_number=1):
        if label_number == 1:
            stimuli = self.objects.filter(labels_one__contains=[input_label])
        elif label_number == 2:
            stimuli = self.objects.filter(labels_two__contains=[input_label])
        elif label_number == 3:
            stimuli = self.objects.filter(labels_three__contains=[input_label])
        elif label_number == 4:
            stimuli = self.objects.filter(labels_four__contains=[input_label])
        else:
            raise FieldDoesNotExist()
        return stimuli



class Metadata(models.Model):
    """Metadata about a site recorded from during an experiment"""
    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE
    )
    information_variable = models.CharField(max_length=30)
    information_value = models.CharField(max_length=30)

    class Meta:
        verbose_name_plural = "metadata"

    def __str__(self):
        return str(str(self.site) + '-' + self.information_variable)


class BinnedData(models.Model):
    """Binned average of data for every site"""
    site=models.ForeignKey(
        Site, on_delete=models.CASCADE
    )
    bin_150_50= ArrayField(
            ArrayField(
                    models.DecimalField(max_digits=15, decimal_places=10),
                blank=True, null=True),
            blank=True, null=True)
    bin_100_30= ArrayField(
            ArrayField(
                    models.DecimalField(max_digits=15, decimal_places=10),
                blank=True, null=True),
            blank=True, null=True)
    bin_50_15 = ArrayField(
            ArrayField(
                    models.DecimalField(max_digits=15, decimal_places=10),
                blank=True, null=True),
            blank=True, null=True)

    labels= ArrayField(models.CharField(max_length=30, null=True, blank=True),
        null=True, blank=True)

    bin_150_50_extents = ArrayField(
            ArrayField(
                models.IntegerField(), blank=True,null=True),
            blank=True,null=True)
    bin_100_30_extents = ArrayField(
            ArrayField(
                models.IntegerField(), blank=True,null=True),
            blank=True,null=True)
    bin_50_15_extents = ArrayField(
            ArrayField(
                models.IntegerField(), blank=True,null=True),
            blank=True,null=True)

    def __str__(self):
        return str(str(self.site) + '-bin')

    def compute_ANOVA(self, bin):
        # return the anova p-value of this neuron
        bin_dict = {
            "3": self.bin_50_15,
            "2": self.bin_100_30,
            "1": self.bin_150_50
        }
        data = bin_dict[bin]
        label_grouped_data = {}
        for n, label in enumerate(self.labels):            
            if label in label_grouped_data:
                label_grouped_data[label].append(data[n])
            else:
                label_grouped_data[label] = [data[n]]
        
        time_transposed_grouped_data = [np.transpose(group).tolist() for group in list(label_grouped_data.values())]

        time_label_grouped_data = list(zip(*time_transposed_grouped_data))
        p_list = [f_oneway(*time_bin)[1] for time_bin in time_label_grouped_data]
        return p_list

