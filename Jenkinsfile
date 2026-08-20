pipeline 
{
    agent any

    stages {
        stage('Environment Check') {
            steps {
                sh 'whoami'
                sh 'docker --version'
                sh 'docker compose version'
            }
        }

        stage('Verify Repository') {
            steps {
                sh 'pwd'
                sh 'git branch --show-current'
                sh 'ls -la'
                sh 'test -f docker-compose.yml'
                sh 'test -f backend/Dockerfile'
                sh 'test -f frontend/Dockerfile'
            }
        }
    }
        
    stage('Build Docker Images') 
    {
        steps {
            sh 'docker compose build'
        }
    }
}
