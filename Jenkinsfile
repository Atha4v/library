pipeline {
    agent any

    stages {
        stage('Environment Check') {
            steps {
                sh 'whoami'
                sh 'docker --version'
                sh 'docker compose version'
            }
        }

        stage('Checkout') {
            steps {
                checkout scm
            }
        }
    }
}
