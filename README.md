
# using docker-compose

1. credentials_sample/ 폴더를 credentials/ 로 이름을 바꾼다.
2. credentials/keys.json 에 자신의 키값을 넣는다.

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