from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import FieldDoesNotExist
from django.db import models


class Experiment(models.Model):
    """Information about each experiment"""
    id = models.CharField(unique=True)
    name = models.TextField()
    description = models.TextField()
    index_stimulus_shown = models.IntegerField()

    def __str__(self):
        return self.experiment_name


class Site(models.Model):
    """Site that data was recorded at"""
    experiment = models.ForeignKey(
        Experiment,
        on_delete=models.CASCADE
    )
    id = models.CharField(30)
    information_variable = models.CharField(30)
    information_value = models.CharField(30)

    def __str__(self):
        return self.experiment.id + '-' + self.id


class Metadata(models.Model):
    """Metadata about a site recorded from during an experiment"""
    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE
    )
    information_variable = models.CharField(30)
    information_value = models.CharField(30)

    def __str__(self):
        return str(self.site) + self.information_variable


class Data(models.Model):
    """Data recorded from a site during an experiment with labels shown"""
    experiment = models.ForeignKey(
        Experiment,
        on_delete=models.CASCADE
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE
    )
    trial_number = models.IntegerField()
    label_1 = models.CharField(30)
    label_2 = models.CharField(30, null=True, blank=True)  # blank=true
    label_3 = models.CharField(30, null=True, blank=True)  # blank=true
    label_4 = models.CharField(30, null=True, blank=True)  # blank=true
    data = ArrayField(models.DecimalField())

    def __str__(self):
        return str(self.site) + '-' + self.trial_number

    def filter_by_label(self, experiment, input_label, label_number=1):
        if label_number == 1:
            stimuli = self.objects.filter(label_1=input_label)
        elif label_number == 2:
            stimuli = self.objects.filter(label_2=input_label)
        elif label_number == 3:
            stimuli = self.objects.filter(label_3=input_label)
        elif label_number == 4:
            stimuli = self.objects.filter(label_4=input_label)
        else:
            raise FieldDoesNotExist()
        return stimuli

    def compute_binned_data(self, bin_size, step_size):
        pass
