
# API 키 설정
1. credentials_sample/ 폴더를 credentials/ 로 이름을 바꾼다.
2. credentials/keys.json 에 자신의 키값을 넣는다.

# Using docker-compose
* docker 설치하면 같이 설치되는 docker-compose 사용
#### 실행
```console
$ docker-compose up -d
```
#### 현재 로그 보기
```console
$ docker-compose logs -f rabbit
```
#### 정지
```console
$ docker-compose down --volumes
```