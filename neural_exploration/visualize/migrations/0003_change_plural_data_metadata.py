# -*- coding: utf-8 -*-
# Generated by Django 1.10.8 on 2017-12-15 20:30
from __future__ import unicode_literals

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('visualize', '0002_load_zhang_data'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='data',
            options={'verbose_name_plural': 'data'},
        ),
        migrations.AlterModelOptions(
            name='metadata',
            options={'verbose_name_plural': 'metadata'},
        ),
    ]
