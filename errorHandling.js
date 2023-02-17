export function errorHandler(err, req, res, next){
    if(err.message=='File too large'){
        res.status(400).send({ message: "File is too large"})
    }
    if(err.status == 500){
        res.status(400).send({message: "Oops! Something went wrong."})
    }
    next()
}