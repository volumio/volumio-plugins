#!/usr/bin/env python3
from setuptools import setup

setup(
    name='ambx',
    version='0.0.1',
    author='Jan Siegmund',
    author_email='jan.siegmund@hotmail.com',
    packages=['ambx'],
    description='Python3 amBX control',
    install_requires=[
        "PyUSB",
    ],
    )